const express = require('express');
const etag = require('../utils/etag/etag');
const { client, connectRedis } = require('../utils/services/redis');

const router = express.Router();
const validateValidJson = require('../middleware/validate_valid_json');

router.post('/', validateValidJson, async (req, res) => {
    if (!req.body.objectId) {
        return res.status(400).send("Bad Request");
    }
    
    const objectId = req.body.objectId;
    await connectRedis();
    
    const existingData = await client.get(objectId);
    if (existingData) {
        await client.quit();
        return res.status(409).send();
    }
    client.on('error', (err) => {
        return res.status(500).send();
    });
    await client.set(objectId, JSON.stringify(req.body));
    const etagValue = etag(req.body);
    res.set('ETag', etagValue);
    await client.quit();
    return res.status(201).json(req.body);
});


module.exports = router;