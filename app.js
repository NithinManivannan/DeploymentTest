const express = require('express');
const { csvToJson, storeDataInPinecone, GetSimilarJobRoles, GetDataForJobPosting, generateFinalJobDescription } = require('./main');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello World 2!');
});

app.post('/api/job-role', async (req, res) => {
    const { jobRole } = req.body;
    const roles = await GetSimilarJobRoles(jobRole);
    const data = await GetDataForJobPosting(jobRole, roles);
    res.json(data);
});

app.post('/api/final-description', async (req, res) => {
    const { jobRole, autoFilledData, answers } = req.body;
    const finalDescription = await generateFinalJobDescription(jobRole, autoFilledData, answers);
    res.json({ finalDescription });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});