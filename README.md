# devdash

`devdash` is a personal CLI dashboard for Linux developers. It now supports both command mode and a lightweight terminal UI when you run `devdash` with no arguments.

## Features

- Save quick notes
- Manage a simple todo list with priorities
- Manage todo due dates
- Review recent activity in one command
- Save reusable captures for snippets and commands
- Open projects from your Linux projects folder
- Track recently opened projects
- Inspect project metadata quickly
- Detect project stack quickly
- Check your local development environment
- Track active work sessions
- Get a daily summary with recent notes and pending tasks
- Store data locally using XDG directories on Linux

## Commands

```bash
devdash
devdash note "Remember to review operating systems notes"
devdash capture add --type command --tag git "git status -sb"
devdash capture list --type command
devdash todo add --priority high "Finish TypeScript CLI parser"
devdash todo add --priority medium --due 2026-04-10 "Finish software engineering homework"
devdash todo due
devdash todo list open
devdash projects
devdash projects dash
devdash project info devdash
devdash project stack devdash
devdash open Personal-Dashboard
devdash open zenith --print-path
devdash recent-projects
devdash session start devdash --note "working on TUI"
devdash session list
devdash doctor
devdash todo done 1
devdash todo remove 1
devdash recent
devdash today
```

You can also use the short command:

```bash
dsh today
dsh projects
dsh
```

## Terminal UI

Run `devdash` or `dsh` without arguments to open the terminal UI.

- `1` home
- `2` todos
- `3` projects
- `4` captures
- `5` sessions
- `r` refresh
- `q` quit

## Project Commands

`devdash open` searches directories in `~/Documents/Projects`.

- Use `devdash open <name>` to launch a project with `xdg-open`
- Use `devdash open <name> --print-path` to only print the absolute path
- Use `devdash project info <name>` to inspect a project's basic metadata
- Use `devdash project stack <name>` to detect the project's likely stack
- Use `devdash projects [query]` to list detected projects and filter by name
- Use `devdash recent-projects` to review your latest opened projects

## Doctor

Use `devdash doctor` to verify core tools such as `node`, `npm`, `git`, `tsc`, `tsx`, and `xdg-open`.

## Todo Priorities

`devdash todo add` accepts:

- `low`
- `medium`
- `high`

You can also add a due date:

```bash
devdash todo add --due 2026-04-10 "Prepare exam summary"
devdash todo due
```

## Capture

Use capture for things you want to reuse later:

```bash
devdash capture add --type snippet --tag ts "type User = { id: number }"
devdash capture add --type command --tag git "git log --oneline --decorate"
devdash capture list
```

## Sessions

Use sessions to mark what you are actively working on:

```bash
devdash session start devdash --note "adding due dates"
devdash session list
```

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
