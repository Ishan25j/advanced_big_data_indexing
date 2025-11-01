const express = require('express');
const router = express.Router();
const { client, connectRedis } = require('../utils/services/redis');
const validateGoogleToken = require('../middleware/auth');

router.delete('/:objectId', validateGoogleToken, async (req, res) => {
    const objectId = req.params.objectId;
    await connectRedis();
    try {
        const data = await client.get(objectId);
        
        if (!data) {
            return res.status(404).send("Not Found");
        }
        
        await client.del(objectId);
        await client.quit();
        
        return res.status(204).send();
    } catch (err) {
        return res.status(500).send();
    }
});

module.exports = router;