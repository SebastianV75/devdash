# devdash

`devdash` is a personal CLI dashboard for Linux developers. The current version focuses on fast capture, lightweight task tracking, and a quick activity view from the terminal.

## Features

- Save quick notes
- Manage a simple todo list with priorities
- Review recent activity in one command
- Open projects from your Linux projects folder
- Track recently opened projects
- Inspect project metadata quickly
- Check your local development environment
- Get a daily summary with recent notes and pending tasks
- Store data locally using XDG directories on Linux

## Commands

```bash
devdash note "Remember to review operating systems notes"
devdash todo add --priority high "Finish TypeScript CLI parser"
devdash todo list open
devdash projects
devdash projects dash
devdash project info devdash
devdash open Personal-Dashboard
devdash open zenith --print-path
devdash recent-projects
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
```

## Project Commands

`devdash open` searches directories in `~/Documents/Projects`.

- Use `devdash open <name>` to launch a project with `xdg-open`
- Use `devdash open <name> --print-path` to only print the absolute path
- Use `devdash project info <name>` to inspect a project's basic metadata
- Use `devdash projects [query]` to list detected projects and filter by name
- Use `devdash recent-projects` to review your latest opened projects

## Doctor

Use `devdash doctor` to verify core tools such as `node`, `npm`, `git`, `tsc`, `tsx`, and `xdg-open`.

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
