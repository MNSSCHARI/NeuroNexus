# Fix: "Cannot POST /api/test-cases/from-story" (404)

The route **is** defined in `index.js`. A 404 means the server running on port 5000 was started **before** the new endpoint was added, so it’s still running old code.

## Fix

1. **Stop the PurpleIQ server**  
   In the terminal where you ran `npm start`, press **Ctrl+C**.

2. **Start it again** (from `PurpleIQ/server`):
   ```bash
   npm start
   ```

3. **Confirm the new route**  
   In the startup log you should see:
   ```text
   POST http://localhost:5000/api/test-cases/from-story (agentic: user story → JSON test cases)
   ```

4. **Run the CSV script again** (in a **different** terminal):
   ```bash
   cd PurpleIQ\server
   npm run csv-test-cases
   ```

After restart, `POST /api/test-cases/from-story` will be available and the script should get 200 instead of 404.
