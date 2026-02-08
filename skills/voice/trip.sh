#!/bin/bash
# Skill: Trip Info (Configurable)
# Generic trip information - configured via environment variables

skill_name="trip"
skill_patterns=("trip" "vacation" "travel" "flight" "hotel")
skill_description="Current trip information"

skill_execute() {
    # Check if trip is configured
    if [ -z "$TRIP_DESTINATION" ]; then
        speak "I don't have any trip information configured right now."
        return 0
    fi
    
    # Build response from environment variables
    local response="You're going to $TRIP_DESTINATION"
    
    if [ -n "$TRIP_DATES" ]; then
        response="$response from $TRIP_DATES"
    fi
    
    if [ -n "$TRIP_FLIGHT_INFO" ]; then
        response="$response. $TRIP_FLIGHT_INFO"
    fi
    
    if [ -n "$TRIP_HOTEL_INFO" ]; then
        response="$response. $TRIP_HOTEL_INFO"
    fi
    
    speak "$response"
}
