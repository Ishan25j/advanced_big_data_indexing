const express = require('express');
const router = express.Router();
const { client, connectRedis } = require('../utils/services/redis');
const etag = require('../utils/etag/etag');

router.get('/:objectId', async (req, res) => {
    const objectId = req.params.objectId;
    await connectRedis();
    try {
        const data = await client.get(objectId);
        if (!data) {
            return res.status(404).send("Not Found");
        }
        
        const etagValue = etag(data);
        
        if (req.headers['if-none-match'] && String(req.headers['if-none-match']) === etagValue) {
            await client.quit();
            return res.status(304).end();
        }
        res.set('ETag', String(etagValue));
        await client.quit();
        return res.status(200).json(JSON.parse(data));
    } catch (err) {
        return res.status(500).send();
    }
});

module.exports = router;