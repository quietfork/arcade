package main

import (
	"fmt"
	"regexp"
	"strings"
)

// SlotRole determines whether this process may write to shared state
// (projects.json, user-level settings.json). The main slot is always
// writer; other slots start as reader and may auto-promote later
// (FR-NEW-20) if the main slot lock goes stale.
type SlotRole string

const (
	RoleWriter SlotRole = "writer"
	RoleReader SlotRole = "reader"
)

// Slot identifies a single cc-launcher window instance for multi-window state
// isolation. Each running process is tied to one slot; the slot name is used
// as a key in lock files and per-slot storage paths under
// ~/.cc-launcher/slots/<name>/.
//
// Role/Lock are zero-valued until AcquireLocksAndDetermineRole runs.
type Slot struct {
	Name string
	Role SlotRole
	Lock *SlotLock
}

// IsWriter reports whether this slot may write shared (user-level) state.
// Slot-level state (its own layout, slot-settings) is always writable.
func (s *Slot) IsWriter() bool {
	return s.Role == RoleWriter
}

// AcquireLocksAndDetermineRole takes the slot's own lock, then decides the
// role. main slot is always writer; for other slots, role depends on
// whether the main slot already has a live writer.
func (s *Slot) AcquireLocksAndDetermineRole() error {
	lock, err := AcquireSlotLock(s.Name)
	if err != nil {
		return err
	}
	s.Lock = lock

	if s.Name == "main" {
		s.Role = RoleWriter
		return nil
	}

	fresh, err := IsMainSlotLockFresh()
	if err != nil {
		// Treat unknown as reader — safer to under-claim than over-write.
		s.Role = RoleReader
		return nil
	}
	if fresh {
		s.Role = RoleReader
	} else {
		// Main slot lock is missing or stale. We *could* promote ourselves
		// here, but FR-NEW-20 owns that loop — keep this commit's scope
		// focused on initial role determination only.
		s.Role = RoleReader
	}
	return nil
}

// Release frees the slot's lock. Safe to call multiple times.
func (s *Slot) Release() {
	if s.Lock != nil {
		s.Lock.Release()
	}
}

// slotNameRegex enforces the slot-name shape: 1-32 chars, ASCII letters,
// digits, underscore, hyphen. Keeps slot names safe as path components and
// filename fragments on every supported OS.
var slotNameRegex = regexp.MustCompile(`^[A-Za-z0-9_-]{1,32}$`)

// windowsReservedNames is the set of legacy Windows device names that cannot
// be used as path components, even with a different extension or case. The
// match is case-insensitive (we uppercase the candidate before lookup).
var windowsReservedNames = map[string]bool{
	"CON": true, "PRN": true, "NUL": true, "AUX": true,
	"COM1": true, "COM2": true, "COM3": true, "COM4": true, "COM5": true,
	"COM6": true, "COM7": true, "COM8": true, "COM9": true,
	"LPT1": true, "LPT2": true, "LPT3": true, "LPT4": true, "LPT5": true,
	"LPT6": true, "LPT7": true, "LPT8": true, "LPT9": true,
}

// ValidateSlotName returns nil iff name is a usable slot identifier.
// See slotNameRegex / windowsReservedNames for the rules.
func ValidateSlotName(name string) error {
	if !slotNameRegex.MatchString(name) {
		return fmt.Errorf("invalid slot name %q: must match ^[A-Za-z0-9_-]{1,32}$", name)
	}
	if windowsReservedNames[strings.ToUpper(name)] {
		return fmt.Errorf("invalid slot name %q: reserved by Windows", name)
	}
	return nil
}

// NewSlot constructs a Slot after validating its name. Returns the validation
// error verbatim so main can surface it to stderr.
func NewSlot(name string) (*Slot, error) {
	if err := ValidateSlotName(name); err != nil {
		return nil, err
	}
	return &Slot{Name: name}, nil
}
