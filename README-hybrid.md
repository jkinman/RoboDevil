# Squidworth Voice Assistant - Hybrid Skill System

A modern, maintainable voice assistant with a **hybrid skill architecture**:
- **Simple skills**: JSON declarative (no code needed)
- **Complex skills**: Node.js/TypeScript (full async logic)

## Architecture

```
skills/
├── skills.json          # Skill registry
├── skill-loader.js      # Hybrid loader
├── node/                # Node.js complex skills
│   ├── lights.js       # Home Assistant integration
│   ├── weather.js      # API calls
│   └── presence.js     # Device detection
└── simple/             # JSON declarative skills
    ├── time.json
    ├── help.json
    └── greeting.json
```

## Simple Skills (JSON)

For static responses, no code needed:

```json
{
  "name": "time",
  "patterns": ["time", "clock"],
  "response": "It's {time:%I:%M %p}.",
  "description": "Tell the current time"
}
```

**Template variables:**
- `{time:%I:%M %p}` - Current time
- `{date:%Y-%m-%d}` - Current date

## Complex Skills (Node.js)

For async operations, API calls, logic:

```javascript
// skills/node/lights.js
async function execute(command, context) {
  // Call Home Assistant
  await haCallService('light', 'turn_on', {
    entity_id: 'light.bedroom'
  });
  
  return "I've turned on the bedroom light.";
}

module.exports = { execute };
```

**Benefits:**
- ✅ Full async/await
- ✅ npm ecosystem
- ✅ Error handling
- ✅ TypeScript ready

## Usage

```bash
# Install dependencies
npm install

# Start the voice assistant
./voice-control-hybrid.sh start

# Check status
./voice-control-hybrid.sh status
```

## Voice Commands

### Simple (JSON skills):
- "What time is it?" → "It's 3:45 PM."
- "Hello" → "Hello! How can I help?"

### Complex (Node.js skills):
- "Turn on bedroom lights"
- "Set lights to 50% brightness"
- "Set hallway to blue"
- "Who is home?"

## Adding New Skills

### Option 1: Simple (JSON)
Edit `skills/skills.json`:

```json
{
  "simpleSkills": {
    "joke": {
      "patterns": ["joke", "funny"],
      "response": "Why don't scientists trust atoms? Because they make up everything!",
      "description": "Tell a joke"
    }
  }
}
```

### Option 2: Complex (Node.js)

1. Create `skills/node/my-skill.js`:
```javascript
async function execute(command, context) {
  // Your logic here
  return "Response from my skill";
}

module.exports = { execute };
```

2. Register in `skills/skills.json`:
```json
{
  "nodeSkills": {
    "mySkill": {
      "patterns": ["my command", "trigger word"],
      "file": "my-skill.js",
      "description": "What my skill does"
    }
  }
}
```

3. Restart: `./voice-control-hybrid.sh restart`

## Comparison with Shell Version

| Feature | Shell | Hybrid Node.js |
|---------|-------|----------------|
| Simple skills | Shell functions | JSON (easier) |
| Complex skills | Shell + curl | Node.js (better) |
| Debugging | Hard (bash) | Easy (console.log) |
| Async | Subshells | async/await |
| Type safety | None | TypeScript ready |
| Testing | Manual | Jest support |

## Migration from Shell

The shell version is kept as `skills/voice/` for reference.
To migrate:

1. Copy shell skill logic to Node.js
2. Replace `curl` with `axios`
3. Use `async/await` instead of background processes
4. Add proper error handling

## Development

```bash
# Install dev dependencies
npm install

# Run with auto-reload (nodemon)
npm run dev

# Run tests
npm test
```

## Environment Variables

```bash
HOME_ASSISTANT_URL=http://localhost:8123
HOME_ASSISTANT_TOKEN=your_token_here
INWORLD_BASIC=your_inworld_token
```
