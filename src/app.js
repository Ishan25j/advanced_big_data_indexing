const express = require('express');
const cors = require('cors');

const createRoute = require('./parser/routes/create');
const getRoute = require('./parser/routes/get');
const updateRoute = require('./parser/routes/update');
const patchRoute = require('./parser/routes/patch');
const deleteRoute = require('./parser/routes/del');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/v1/plan', createRoute);
app.use('/v1/plan', getRoute);
app.use('/v1/plan', updateRoute);
app.use('/v1/plan', patchRoute);
app.use('/v1/plan', deleteRoute);

app.use((req, res) => {
  res.status(404).send('Not Found');
});

module.exports = app;