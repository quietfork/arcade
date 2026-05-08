package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestAcquireSlotLock_Basic(t *testing.T) {
	withTempHome(t, func(home string) {
		lock, err := AcquireSlotLock("main")
		if err != nil {
			t.Fatalf("acquire: %v", err)
		}
		defer lock.Release()

		// Lock file should exist.
		path := filepath.Join(home, ".arcade", "slots", "main", "lock.json")
		if _, err := os.Stat(path); err != nil {
			t.Fatalf("lock file not created: %v", err)
		}
	})
}

func TestAcquireSlotLock_Conflict(t *testing.T) {
	withTempHome(t, func(home string) {
		first, err := AcquireSlotLock("main")
		if err != nil {
			t.Fatalf("first acquire: %v", err)
		}
		defer first.Release()

		// Second acquire on the same slot should fail because heartbeat is fresh.
		if _, err := AcquireSlotLock("main"); err == nil {
			t.Fatal("expected conflict error, got nil")
		}
	})
}

func TestAcquireSlotLock_DifferentSlots(t *testing.T) {
	withTempHome(t, func(home string) {
		main, err := AcquireSlotLock("main")
		if err != nil {
			t.Fatal(err)
		}
		defer main.Release()
		// Different slot is independent.
		second, err := AcquireSlotLock("second")
		if err != nil {
			t.Fatalf("second slot should not conflict: %v", err)
		}
		second.Release()
	})
}

func TestAcquireSlotLock_StaleReclaim(t *testing.T) {
	withTempHome(t, func(home string) {
		dir := filepath.Join(home, ".arcade", "slots", "main")
		if err := os.MkdirAll(dir, 0o700); err != nil {
			t.Fatal(err)
		}
		lockPath := filepath.Join(dir, "lock.json")
		// Plant a lock from a "dead" prior process.
		if err := os.WriteFile(lockPath, []byte(`{"pid":99999,"slot":"main"}`), 0o600); err != nil {
			t.Fatal(err)
		}
		old := time.Now().Add(-2 * heartbeatStaleTTL)
		if err := os.Chtimes(lockPath, old, old); err != nil {
			t.Fatal(err)
		}

		lock, err := AcquireSlotLock("main")
		if err != nil {
			t.Fatalf("expected stale lock to be reclaimed: %v", err)
		}
		lock.Release()
	})
}

func TestRelease_Idempotent(t *testing.T) {
	withTempHome(t, func(home string) {
		lock, err := AcquireSlotLock("main")
		if err != nil {
			t.Fatal(err)
		}
		lock.Release()
		lock.Release() // must not panic
	})
}

func TestSlot_AcquireLocksAndDetermineRole_MainIsWriter(t *testing.T) {
	withTempHome(t, func(home string) {
		s, _ := NewSlot("main")
		if err := s.AcquireLocksAndDetermineRole(); err != nil {
			t.Fatal(err)
		}
		defer s.Release()
		if s.Role != RoleWriter {
			t.Errorf("main role=%q want writer", s.Role)
		}
		if !s.IsWriter() {
			t.Error("main should report IsWriter=true")
		}
	})
}

func TestSlot_TryPromote_PromotesWhenMainStale(t *testing.T) {
	withTempHome(t, func(home string) {
		// Simulate a dead main slot: a stale lock file with old mtime.
		mainDir := filepath.Join(home, ".arcade", "slots", "main")
		if err := os.MkdirAll(mainDir, 0o700); err != nil {
			t.Fatal(err)
		}
		mainLockPath := filepath.Join(mainDir, "lock.json")
		if err := os.WriteFile(mainLockPath, []byte(`{"pid":99999,"slot":"main"}`), 0o600); err != nil {
			t.Fatal(err)
		}
		old := time.Now().Add(-2 * heartbeatStaleTTL)
		if err := os.Chtimes(mainLockPath, old, old); err != nil {
			t.Fatal(err)
		}

		second, _ := NewSlot("second")
		if err := second.AcquireLocksAndDetermineRole(); err != nil {
			t.Fatal(err)
		}
		defer second.Release()
		if second.Role != RoleReader {
			t.Fatalf("expected reader before promote, got %q", second.Role)
		}

		second.tryPromote()

		if second.Role != RoleWriter {
			t.Errorf("expected writer after tryPromote, got %q", second.Role)
		}
		if second.mainLock == nil {
			t.Error("mainLock should be non-nil after promotion")
		}
	})
}

func TestSlot_TryPromote_NoOpWhenMainAlive(t *testing.T) {
	withTempHome(t, func(home string) {
		main, _ := NewSlot("main")
		if err := main.AcquireLocksAndDetermineRole(); err != nil {
			t.Fatal(err)
		}
		defer main.Release()

		second, _ := NewSlot("second")
		if err := second.AcquireLocksAndDetermineRole(); err != nil {
			t.Fatal(err)
		}
		defer second.Release()

		second.tryPromote()

		if second.Role != RoleReader {
			t.Errorf("should not promote while main alive, role=%q", second.Role)
		}
	})
}

func TestSlot_TryPromote_FiresOnRoleChangeOnce(t *testing.T) {
	withTempHome(t, func(home string) {
		// Stale main lock.
		mainDir := filepath.Join(home, ".arcade", "slots", "main")
		if err := os.MkdirAll(mainDir, 0o700); err != nil {
			t.Fatal(err)
		}
		p := filepath.Join(mainDir, "lock.json")
		if err := os.WriteFile(p, []byte(`{}`), 0o600); err != nil {
			t.Fatal(err)
		}
		old := time.Now().Add(-2 * heartbeatStaleTTL)
		_ = os.Chtimes(p, old, old)

		second, _ := NewSlot("second")
		if err := second.AcquireLocksAndDetermineRole(); err != nil {
			t.Fatal(err)
		}
		defer second.Release()

		var fires int
		second.mu.Lock()
		second.onRoleChange = func() { fires++ }
		second.mu.Unlock()

		second.tryPromote()
		// Calling again — still writer, must NOT fire onRoleChange again.
		second.tryPromote()

		if fires != 1 {
			t.Errorf("onRoleChange fired %d times, want 1", fires)
		}
	})
}

func TestSlot_AcquireLocksAndDetermineRole_SecondIsReaderWhenMainAlive(t *testing.T) {
	withTempHome(t, func(home string) {
		// Plant a fresh main lock to simulate the writer being alive.
		main, _ := NewSlot("main")
		if err := main.AcquireLocksAndDetermineRole(); err != nil {
			t.Fatal(err)
		}
		defer main.Release()

		second, _ := NewSlot("second")
		if err := second.AcquireLocksAndDetermineRole(); err != nil {
			t.Fatal(err)
		}
		defer second.Release()

		if second.Role != RoleReader {
			t.Errorf("second role=%q want reader (main is alive)", second.Role)
		}
	})
}
