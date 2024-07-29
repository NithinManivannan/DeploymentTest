const express = require('express');
const cors = require('cors');
const { csvToJson, storeDataInPinecone, GetSimilarJobTitles, generateFinalJobDescription } = require('./main');

const app = express();
const port = process.env.PORT || 3000;

// Use CORS middleware
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello Yem!');
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
