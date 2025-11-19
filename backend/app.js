const express = require('express');
const mongoose = require('mongoose');
const Contact = require('./models/contact');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config(); 
const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS FIRST - handles preflight OPTIONS requests
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

// Body parsing middleware - must come after CORS
// Use body-parser for more explicit control
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Debug middleware AFTER body parsing to see what was parsed
app.use((req, res, next) => {
  if (req.path.includes('/api/auth/signup') && req.method === 'POST') {
    console.log('=== SIGNUP REQUEST AFTER PARSING ===');
    console.log('Content-Type:', req.get('Content-Type'));
    console.log('Body keys:', Object.keys(req.body));
    console.log('Body:', JSON.stringify(req.body));
  }
  next();
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON Parse Error:', err.message);
    return res.status(400).json({ msg: 'Invalid JSON in request body', error: err.message });
  }
  next(err);
});




mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected ✅'))
  .catch((err) => console.error('MongoDB connection error:', err));
  app.get('/', (req, res) => {
    res.send('Server is up and running 🚀');
  });
  app.use("/api/auth", require("./routes/authRoutes"));
  

  app.get('/api/contacts/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
      const userContacts = await Contact.findOne({ userId });
      res.json(userContacts?.contacts || []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Add a new contact
  app.post('/api/contacts/:userId', async (req, res) => {
    const { userId } = req.params;
    const { name, phone, relation } = req.body;
   console.log("user id is:",userId)
    try {
      let userContacts = await Contact.findOne({ userId });
  
      if (!userContacts) {
        userContacts = new Contact({ userId:userId, contacts: [] });
      }
  
      userContacts.contacts.push({ name, phone, relation });
      await userContacts.save();
  
      res.status(201).json(userContacts.contacts);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

    // Delete a contact
app.delete('/api/contacts/:userId/:contactId', async (req, res) => {
  const { userId, contactId } = req.params;
  
  try {
    const userContacts = await Contact.findOne({ userId });
    
    if (!userContacts) {
      return res.status(404).json({ error: "User contacts not found" });
    }
    
    // Find the index of the contact to delete
    const contactIndex = userContacts.contacts.findIndex(
      contact => contact._id.toString() === contactId
    );
    
    if (contactIndex === -1) {
      return res.status(404).json({ error: "Contact not found" });
    }
    
    // Remove the contact from the array
    userContacts.contacts.splice(contactIndex, 1);
    
    // Save the updated contacts
    await userContacts.save();
    
    res.json(userContacts.contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a contact
app.put('/api/contacts/:userId/:contactId', async (req, res) => {
  const { userId, contactId } = req.params;
  const { name, phone, relation } = req.body;
  
  try {
    const userContacts = await Contact.findOne({ userId });
    
    if (!userContacts) {
      return res.status(404).json({ error: "User contacts not found" });
    }
    
    // Find the index of the contact to update
    const contactIndex = userContacts.contacts.findIndex(
      contact => contact._id.toString() === contactId
    );
    
    if (contactIndex === -1) {
      return res.status(404).json({ error: "Contact not found" });
    }
    
    // Update the contact
    userContacts.contacts[contactIndex] = {
      ...userContacts.contacts[contactIndex],
      name,
      phone,
      relation
    };
    
    // Save the updated contacts
    await userContacts.save();
    
    res.json(userContacts.contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

  // Start server
  app.listen(PORT, '0.0.0.0', () => {
    console.log("Server is running on port", PORT);
    console.log("Access the server at:", `http://10.101.102.178:${PORT}`);
  });
