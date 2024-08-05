const express = require('express');
const cors = require('cors');
const { csvToJson, storeDataInPinecone, GetSimilarJobTitles, generateFinalJobDescription } = require('./main');
const { getEmbedding } = require('./APILayer/openai');
const { searchVector } = require('./APILayer/pinecone');
require('dotenv').config();


const app = express();
const port = process.env.PORT || 3000;

// Use CORS middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://white-forest-07118231e.5.azurestaticapps.net'
}));


// Middleware to parse JSON bodies
app.use(express.json());

app.get('/', async (req, res) => {
  res.send('Hello Yem!');
});

app.get('/updatepinecone', async (req, res) => {
  try {
      await storeDataInPinecone();
      res.send('Data successfully stored in Pinecone.');
  } catch (error) {
    console.error("Failed to store data:", error);
    res.status(500).send('Failed to update data in Pinecone: ' + error.message);
  }
});

app.post('/api/final-description', async (req, res) => {
  console.log("Received request body:", req.body);  // Check what is being received
  const { jobTitle, wordsToUse, wordsToAvoid, additionalInfo } = req.body;

  if (!jobTitle) {
      console.error("Job title is missing.");
      return res.status(400).send("Job title is required.");
  }

  try {
      const finalDescription = await generateFinalJobDescription({
          jobTitle,
          wordsToUse,
          wordsToAvoid,
          additionalInfo
      });
      res.json({ finalDescription });
  } catch (error) {
      console.error("Failed to generate description:", error);
      res.status(500).send('Failed to generate job description: ' + error.message);
  }
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
