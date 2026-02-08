#!/bin/bash
# Skill: Flight Info
# Provides flight details for Maui trip

skill_name="flight"
skill_patterns=("flight" "plane" "westjet" "airport")
skill_description="Flight information for Maui trip"

skill_execute() {
    speak "Your WestJet confirmation is HNVLFC. You're flying out on February 10th at 10:30 AM, arriving in Maui at 3 PM. Your return flight is on February 18th at 11:30 PM, getting back to Vancouver at 7:15 AM the next morning."
}
