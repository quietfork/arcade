package main

import (
	"testing"
)

func TestSettingsStore_LoadDefaults(t *testing.T) {
	withTempHome(t, func(home string) {
		slot, _ := NewSlot("main")
		slot.Role = RoleWriter
		s := NewSettingsStore(slot)
		got, err := s.Load()
		if err != nil {
			t.Fatal(err)
		}
		if got.Theme != "dark" {
			t.Errorf("default Theme=%q want dark", got.Theme)
		}
		if got.ActiveView != "workspace" {
			t.Errorf("default ActiveView=%q want workspace", got.ActiveView)
		}
		if got.Scrollback != 10000 {
			t.Errorf("default Scrollback=%d want 10000", got.Scrollback)
		}
	})
}

func TestSettingsStore_RoundTripSplit(t *testing.T) {
	withTempHome(t, func(home string) {
		slot, _ := NewSlot("second")
		slot.Role = RoleWriter // grant writer for the round-trip test
		s := NewSettingsStore(slot)

		want := Settings{
			Theme:            "light",
			FontSize:         15,
			DefaultCommand:   "claude",
			DefaultArgs:      []string{"--dangerously-skip-permissions"},
			Scrollback:       12000,
			DangerousConsent: true,
			SidebarHidden:    true,
			ActiveView:       "explorer",
		}
		if err := s.Save(want); err != nil {
			t.Fatal(err)
		}

		got, err := s.Load()
		if err != nil {
			t.Fatal(err)
		}
		if got.Theme != want.Theme || got.FontSize != want.FontSize ||
			got.Scrollback != want.Scrollback || got.DangerousConsent != want.DangerousConsent {
			t.Errorf("user-level fields lost: got=%+v want=%+v", got, want)
		}
		if got.SidebarHidden != want.SidebarHidden || got.ActiveView != want.ActiveView {
			t.Errorf("slot-level fields lost: got=%+v want=%+v", got, want)
		}
	})
}

func TestSettingsStore_SlotIsolation(t *testing.T) {
	// Two slots share user-level settings but have independent slot-level state.
	withTempHome(t, func(home string) {
		slotA, _ := NewSlot("main")
		slotA.Role = RoleWriter
		slotB, _ := NewSlot("second")
		slotB.Role = RoleReader // realistic: only main is writer
		a := NewSettingsStore(slotA)
		b := NewSettingsStore(slotB)

		// A writes a full Settings: theme=light, sidebarHidden=false.
		if err := a.Save(Settings{
			Theme:         "light",
			ActiveView:    "workspace",
			SidebarHidden: false,
			Scrollback:    9999,
		}); err != nil {
			t.Fatal(err)
		}
		// B writes its own slot-only state.
		if err := b.SetSidebarState(true, "explorer"); err != nil {
			t.Fatal(err)
		}

		gotA, _ := a.Load()
		gotB, _ := b.Load()

		// User-level shared.
		if gotA.Theme != "light" || gotB.Theme != "light" {
			t.Errorf("user-level theme not shared: A=%q B=%q", gotA.Theme, gotB.Theme)
		}
		if gotA.Scrollback != 9999 || gotB.Scrollback != 9999 {
			t.Errorf("user-level scrollback not shared: A=%d B=%d", gotA.Scrollback, gotB.Scrollback)
		}
		// Slot-level independent.
		if gotA.SidebarHidden != false || gotA.ActiveView != "workspace" {
			t.Errorf("slot A clobbered: %+v", gotA)
		}
		if gotB.SidebarHidden != true || gotB.ActiveView != "explorer" {
			t.Errorf("slot B not preserved: %+v", gotB)
		}
	})
}
