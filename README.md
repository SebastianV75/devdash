# devdash

`devdash` is a personal CLI dashboard for Linux developers. The current version focuses on fast capture, lightweight task tracking, and a quick activity view from the terminal.

## Features

- Save quick notes
- Manage a simple todo list with priorities
- Review recent activity in one command
- Get a daily summary with recent notes and pending tasks
- Store data locally using XDG directories on Linux

## Commands

```bash
devdash note "Remember to review operating systems notes"
devdash todo add --priority high "Finish TypeScript CLI parser"
devdash todo list open
devdash todo done 1
devdash todo remove 1
devdash recent
devdash today
```

## Todo Priorities

`devdash todo add` accepts:

- `low`
- `medium`
- `high`

## Development

```bash
npm install
npm run dev -- today
```

## Build

```bash
npm run build
npm start -- today
```

## Local data

The CLI stores data in:

- `$XDG_DATA_HOME/devdash/data.json`
- or `~/.local/share/devdash/data.json` when `XDG_DATA_HOME` is not set
