import { createApp } from "./app/app.js";

const app = createApp();
const port = process.env.PORT ?? 3000

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
