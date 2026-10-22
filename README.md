# Recetario

Save recipes from YouTube videos or any recipe website — share a link in, get a
clean written recipe out: title, ingredients (with imperial units converted to
grams/ml), and step-by-step instructions, auto-sorted into categories.

Installable as a PWA on Android, so YouTube's own share sheet can send videos
straight into the app.

## Features

- **Import from anywhere**: paste a link, or share one from the YouTube app or
  any recipe website's share menu. Websites are read via their schema.org
  recipe data (what most cooking sites embed for Google); YouTube videos via
  their transcript.
- **Unit conversion**: pounds/ounces → grams, cups/tablespoons/teaspoons →
  milliliters, done with exact math, not AI guessing.
- **Scaling**: 0.5x/2x/3x or a custom multiplier, applied live on the recipe
  page.
- **Auto-categorization**: an AI suggestion matched against your existing
  categories, always editable, with manual category creation too.
- **Cooking Mode**: keeps your phone's screen from sleeping while you cook.
- **Multi-user**: each account has its own private recipe collection.

## Stack

React + TypeScript + Vite (PWA via `vite-plugin-pwa`), Supabase (Postgres +
Auth + Edge Functions), Supadata (YouTube transcripts), Groq (recipe
structuring).

## Setup

See [SETUP.md](SETUP.md) for the full walkthrough (Supabase project, API
keys, deploying, and installing on Android).
