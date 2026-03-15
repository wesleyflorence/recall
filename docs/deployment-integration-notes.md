# Recall deployment integration notes

The following external changes are required to expose Recall at `/recall` behind the shared Caddy gateway:

- In `~/code/caddy/Caddyfile`, add:

  ```caddy
  handle_path /recall/* {
    reverse_proxy localhost:18104
  }
  ```

- In `~/code/caddy/PORTS.md`, add `18104: Recall`.

- Copy and load the generated plist file for launchd:
  `cp ~/code/recall/deploy/com.wesleyflorence.recall.plist ~/Library/LaunchAgents/com.wesleyflorence.recall.plist`
  then
  `launchctl unload ~/Library/LaunchAgents/com.wesleyflorence.recall.plist 2>/dev/null || true`
  `launchctl load ~/Library/LaunchAgents/com.wesleyflorence.recall.plist`.

- Reload Caddy after updating routes.
