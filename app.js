const express = require('express');
const cors = require('cors');
const { csvToJson, storeDataInPinecone, GetSimilarJobTitles, generateFinalJobDescription } = require('./main');
const { getEmbedding } = require('./APILayer/openai');
const { searchVector } = require('./APILayer/pinecone');
require('dotenv').config();


const app = express();
const port = process.env.PORT || 3000;

// Use CORS middleware
app.use(cors());

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
    const { jobRole, responsibilities, qualifications, recommendedWords, wordsToAvoid } = req.body;
    console.log("Received data:", req.body);
    // Process the input to generate a job description
    const finalDescription = await generateFinalJobDescription({
        jobRole,
        responsibilities,
        qualifications,
        recommendedWords,
        wordsToAvoid
    });

    res.json({ finalDescription });
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
