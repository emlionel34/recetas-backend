const express = require('express'); 
const recipeRoutes = require('./routes/recipes'); 
const authRoutes = require('./routes/auth'); 
const favoriteRoutes = require('./routes/favorites');
const userRoutes = require('./routes/users');
const oauthRoutes = require('./routes/oauth');
 
const app = express(); 

// En la nube el puerto lo asigna el servidor (process.env.PORT).
// En tu compu sigue siendo 4000.
const PORT = process.env.PORT || 4000; 
 
app.use(express.json()); 

app.use('/api/recipes', recipeRoutes); 
app.use('/api/auth', authRoutes);
app.use('/api/auth', oauthRoutes); 
app.use('/api/favorites', favoriteRoutes);
app.use('/api/users', userRoutes);
 
app.get('/', (req, res) => { 
    res.send('Hola Emi, mi backend funciona'); 
}); 
 
app.listen(PORT, () => { 
    console.log(`Servidor corriendo en el puerto ${PORT}`); 
});
