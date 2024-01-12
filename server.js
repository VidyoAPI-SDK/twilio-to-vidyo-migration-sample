require('dotenv').config();
const express = require('express');
const app = express();
const port = 8080;
const AccessToken = require('twilio').jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;

const twilioClient = require('twilio')(process.env.TWILIO_API_KEY_SID,
  process.env.TWILIO_API_KEY_SECRET, { accountSid: process.env.TWILIO_ACCOUNT_SID });

app.use(express.json());

// Serve static files from the public directory
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile('public/index.html');
});

app.post('/token', async (req, res) => {
  if (!req.body.identity || !req.body.room) {
    return res.status(400).send({message: 'username and room is required'});
  }

  // Get the user's identity and the room name from the request
  const identity  = req.body.identity;
  const roomName  = req.body.room;

  try {
    // See if the room exists already
    const roomList = await twilioClient.video.v1.rooms.list({uniqueName: roomName, status: 'in-progress'});

    let room;

    if (!roomList.length) {
      // Call the Twilio video API to create the new Go room
      room = await twilioClient.video.v1.rooms.create({
        uniqueName: roomName,
      });
    } else {
      room = roomList[0];
    }

    // Create a video grant for this specific room
    const videoGrant = new VideoGrant({
      room: room.uniqueName,
    })

    // Create an access token
    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY_SID,
      process.env.TWILIO_API_KEY_SECRET,
      { identity }
    );

    // Add the video grant and the user's identity to the token
    token.addGrant(videoGrant);
    //token.identity = identity;

    // Serialize the token to a JWT and return it to the client side
    res.send({
      token: token.toJwt()
    });

  } catch (error) {
    res.status(400).send({error});
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`Express server running on port http://127.0.0.1:${port}/`);
});