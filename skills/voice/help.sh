#!/bin/bash
# Skill: Help
# Lists available skills

skill_name="help"
skill_patterns=("help" "what can you do" "commands" "skills")
skill_description="List available commands"

skill_execute() {
    speak "I can control your home lights, tell you the time, and help with trip information if you have any travel plans coming up. Just ask!"
}
