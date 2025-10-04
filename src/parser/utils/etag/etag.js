const crypto = require('crypto');
const etag = (data) => {
  const hash = crypto.createHash('sha1').update(JSON.stringify(data)).digest('hex');
  return hash;
};

module.exports = etag;