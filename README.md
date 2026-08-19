# Amin Workspace — Node + JSON

Zero-dependency Node.js backend. Shared data is persisted in `data.json`, so the same tasks and notes are visible from every device.

## Run

Node.js 18+:

```bash
cd amin-workspace-node-json
APP_SECRET="replace-this-with-a-long-random-secret" npm start
```

Default port: `43127`.

You can also use:

```bash
HOST=127.0.0.1 PORT=3000 APP_SECRET="your-secret" npm start
```

Then reverse-proxy `task.aminettefagh.ir` to this Node process using nginx, Apache, Caddy, etc.

## Important

- `data.json` must be writable by the Node process.
- Do **not** expose `data.json` directly from nginx/Apache.
- Change the passwords in `server.js` before production use.
- Set a strong `APP_SECRET` environment variable.
- The server enforces Viewer read-only behavior and prevents Task from directly applying approved-task edits; Task changes remain approval requests.


## Update existing server safely

This package is intended to replace only the app files in `/opt/amin-task`.
It does not modify Nginx, Certbot, DNS, or any other service.

Recommended update:

```bash
cp /opt/amin-task/data.json /opt/amin-task/data-backup-$(date +%Y%m%d-%H%M%S).json

cp index.html style.css app.js server.js package.json /opt/amin-task/

systemctl restart amin-task
systemctl status amin-task --no-pager
curl -I http://127.0.0.1:43127
```

Keep the existing `/opt/amin-task/data.json` on the server so current tasks and logs remain intact.
