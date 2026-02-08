#!/bin/bash
# Skill: Time
# Provides current time

skill_name="time"
skill_patterns=("time" "clock" "what time")
skill_description="Tell the current time"

skill_execute() {
    local current_time=$(date +"%I:%M %p")
    speak "It's $current_time."
}
