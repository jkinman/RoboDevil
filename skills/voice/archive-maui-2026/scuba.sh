#!/bin/bash
# Skill: Scuba Trip
# Provides scuba/snorkel trip details

skill_name="scuba"
skill_patterns=("scuba" "dive" "snorkel" "molokini" "turtle town")
skill_description="Scuba and snorkel trip information"

skill_execute() {
    speak "Your scuba and snorkel trip is scheduled for February 11th. You'll want to call Kai Kanani at 808-879-7218 to book your spots. Don't forget to bring your certification card for diving!"
}
