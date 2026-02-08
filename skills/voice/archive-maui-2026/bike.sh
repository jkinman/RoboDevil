#!/bin/bash
# Skill: Bike Tour
# Provides Haleakala bike tour details

skill_name="bike"
skill_patterns=("bike" "haleakala" "sunrise" "mountain riders")
skill_description="Haleakala bike tour information"

skill_execute() {
    speak "Your Haleakala sunrise bike tour is on February 14th. You'll need to meet at Maui Mountain Riders in Paia at 4:30 AM. Make sure you've signed the waiver online, and dress warmly because it's freezing at the summit!"
}
