#!/bin/bash
# Skill: Road to Hana
# Provides Road to Hana trip details

skill_name="hana"
skill_patterns=("hana" "road to hana" "black sand" "wai'anapanapa")
skill_description="Road to Hana trip information"

skill_execute() {
    speak "Your Road to Hana adventure is on February 16th. Make sure to leave by 8 AM for your 10 AM reservation at Wai'anapanapa black sand beach. Your reservation number is VISITOR-2026-02-07-WSP-1885316."
}
