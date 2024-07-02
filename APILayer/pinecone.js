const { Pinecone } = require("@pinecone-database/pinecone");
const { getEmbedding } = require("./openai");
const percentile = require('percentile');

// Initialize Pinecone client with the API key
const pc = new Pinecone({
    apiKey: "4351efc4-801a-47ea-b020-7e1d236f848d",
});
const index = pc.index("newsbuddy");

function todaysNameSpaceGenerator(namespace, daysAgo) {
    const today = new Date();
    const date = today.getDate() - (daysAgo || 0);
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    return `${namespace}`;
}

async function writeVectors(vectors, namespace) {
    const todaysNamespace = todaysNameSpaceGenerator(namespace);
    try {

        await index.namespace(todaysNamespace).upsert(vectors);

        console.log('Successfully wrote vectors');
        return true;
    } catch (error) {
        console.error('Error in writeVectors function', { error: error.message });
    }
}

async function searchVector(queryString, namespace, topKLimit, filters = {}) {
    const todaysNamespace = todaysNameSpaceGenerator(namespace);
    try {
        const data = await getEmbedding(queryString);

        // Create the query request
        const queryResponse = await index.namespace(todaysNamespace).query({
            vector: data,
            topK: topKLimit,
            includeMetadata: true,
        });

        let queryResponseMatches = queryResponse.matches;

        return queryResponseMatches;
    } catch (error) {
        console.error('Error in searchVector function', { error: error.message, queryString, todaysNamespace, topKLimit, filters });
    }
}

async function search2DaysOfVectors(queryString, namespace, topKLimit, filters = {}) {
    const todaysNamespace = todaysNameSpaceGenerator(namespace);
    const yesterdaysNamespace = todaysNameSpaceGenerator(namespace, 1);

    try {
        const data = await getEmbedding(queryString);

        // Create the query request
        const todaysQueryResponse = await index.namespace(todaysNamespace).query({
            vector: data,
            topK: topKLimit,
            includeMetadata: true,
        });

        const yesterdaysQueryResponse = await index.namespace(yesterdaysNamespace).query({
            vector: data,
            topK: topKLimit,
            includeMetadata: true,
        });

        let queryResponseMatches = todaysQueryResponse.matches.concat(yesterdaysQueryResponse.matches);

        return queryResponseMatches;
    } catch (error) {
        console.error('Error in search2DaysOfVectors function', { error: error.message, queryString, todaysNamespace, topKLimit, filters });
    }
}

function filterExactMatches(results) {
    if (results.length === 0) return [];

    // Sort results by score in descending order
    const sortedResults = results.sort((a, b) => b.score - a.score);

    // Calculate score differences
    const scoreDiffs = [];
    for (let i = 1; i < sortedResults.length; i++) {
        scoreDiffs.push(sortedResults[i - 1].score - sortedResults[i].score);
    }

    // Identify the index of the largest gap
    const maxDiffIndex = scoreDiffs.indexOf(Math.max(...scoreDiffs));

    // Calculate threshold
    let threshold = 0.86;
    if (sortedResults[maxDiffIndex] && sortedResults[maxDiffIndex + 1]) {
        threshold = (sortedResults[maxDiffIndex].score + sortedResults[maxDiffIndex + 1].score) / 2;
    }

    return sortedResults.filter(result => result.score >= threshold && result.score >= 0.86);
}

function keepRelevantMatches(queryResponseMatches) {
    if (queryResponseMatches.length === 0) return [];

    // Calculate the percentile limits and the standard deviations
    const scores = queryResponseMatches.map(match => match.score).sort((a, b) => a - b);
    const elbowPoints = findElbows(scores, 1);

    let similarityScoreLimits = [];
    for (let i = 0; i < elbowPoints.length; i++) {
        const percentileLimit = elbowPoints[i] * 100;
        const stdDevFactor = 1 - percentileLimit / 100;
        const percentileScore = percentile(percentileLimit, scores);
        const stdDevScore = standardDeviation(scores);
        const limit = percentileScore + stdDevFactor * stdDevScore;
        similarityScoreLimits.push(limit);
    }

    // Use the maximum limit as the threshold for filtering matches
    let similarityScoreLimit = Math.max(...similarityScoreLimits);

    similarityScoreLimit = similarityScoreLimit > 0.79 ? 0.79 : similarityScoreLimit;

    queryResponseMatches = queryResponseMatches.filter(match => match.score >= similarityScoreLimit);

    return queryResponseMatches;
}

// Function to find the elbow point in a curve
// The elbow point represents the threshold at which the scores start to increase more rapidly.
// It's like finding the point in a list of items sorted by relevancy where the items stop being irrelevant and start being relevant.
// Anything above the elbow point is considered relevant.
const findElbows = (arr, numOfElbows = 2) => {
    const elbows = [];
    let data = [...arr]; // create a copy of the array

    for (let k = 0; k < numOfElbows; k++) {
        let maxDistance = 0;
        let elbowIndex = 0;
        const [x1, y1] = [0, data[0]];
        const [x2, y2] = [data.length - 1, data[data.length - 1]];

        for (let i = 1; i < data.length; i++) {
            const [x0, y0] = [i, data[i]];
            const numerator = Math.abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1);
            const denominator = Math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2);
            const distance = numerator / denominator;

            if (distance > maxDistance) {
                maxDistance = distance;
                elbowIndex = i;
            }
        }

        elbows.push(elbowIndex / data.length);

        // Update data to calculate next elbow point
        data = data.slice(elbowIndex);
    }

    return elbows;
};

const standardDeviation = (arr, usePopulation = false) => {
    const mean = arr.reduce((acc, val) => acc + val, 0) / arr.length;
    return Math.sqrt(
        arr.reduce((acc, val) => acc.concat((val - mean) ** 2), []).reduce((acc, val) => acc + val, 0) /
        (arr.length - (usePopulation ? 0 : 1))
    );
};

module.exports = {
    writeVectors,
    searchVector,
    search2DaysOfVectors,
    keepRelevantMatches,
    filterExactMatches
}