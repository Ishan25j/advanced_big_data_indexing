const Ajv = require("ajv");
const jsonSchema = require("../utils/models/schema.json");

const ajv = new Ajv();
const validate = ajv.compile(jsonSchema);

const validateValidJson = (req, res, next) => {
    const jsonData = req.body;

    const valid = validate(jsonData);
    if (!valid) {
        return res.status(400).send("Bad Request");
    }
    next();
};

module.exports = validateValidJson;