#!/bin/bash
# Skill: Hotel Info
# Provides hotel details

skill_name="hotel"
skill_patterns=("hotel" "room" "kihei" "maui coast")
skill_description="Hotel information"

skill_execute() {
    speak "You're staying at the Maui Coast Hotel in Kihei from February 10th through 13th. Your room is the Hoku King, and the confirmation number is 1039325495."
}
