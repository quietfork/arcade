package main

import "testing"

func TestValidateSlotName(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{"default main", "main", false},
		{"alphanumeric", "second", false},
		{"with underscore", "my_slot", false},
		{"with hyphen", "my-slot", false},
		{"max length 32", "abcdefghijklmnopqrstuvwxyz123456", false},

		{"empty", "", true},
		{"too long 33", "abcdefghijklmnopqrstuvwxyz1234567", true},
		{"contains slash", "my/slot", true},
		{"contains backslash", `my\slot`, true},
		{"contains dot", "my.slot", true},
		{"contains space", "my slot", true},
		{"contains colon", "my:slot", true},

		{"reserved CON", "CON", true},
		{"reserved con lowercase", "con", true},
		{"reserved Nul mixed case", "Nul", true},
		{"reserved COM1", "COM1", true},
		{"reserved LPT9", "LPT9", true},
		{"COM10 not reserved", "COM10", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSlotName(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateSlotName(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}
