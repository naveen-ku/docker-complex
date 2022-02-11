const keys = require('./keys');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const redis = require('redis');


// Express
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgress

const pgClient = new Pool ({
	host: keys.pgHost,
	user: keys.pgUser,
	database: keys.pgDatabase,
	password: keys.pgPassword,
	port: keys.pgPort
});

pgClient.on('error', () => console.log('Lost PG connection'));


// Postgress Create table
pgClient
	.query('CREATE TABLE IF NOT EXISTS values (number INT)')
	.then(() =>console.log("Table created"))
	.catch(err => console.log(err));

// Redis Client setup
const redisClient = redis.createClient({
	host: keys.redisHost,
	port: keys.redisPort,
	retry_strategy: () =>1000
});

const redisPublisher = redisClient.duplicate();


// Express route handlers
app.get('/',(req,res) => {
	res.send('Hi');
});


app.get('/values/all', async (req,res) => {
	const values = await pgClient.query('SELECT * FROM values');
	console.log('All values (Postgress): ', values);
	res.send(values.rows);
});

app.get('/values/current', async (req,res) => {
	redisClient.hgetall('values',(err, values) => {
		console.log('Current values (Redis): ', values);
		res.send(values);
	})
});
 
app.post('/values', async (req,res) => {
	const index = req.body.index;
	if(parseInt(index)>40){
		return res.status(422).send('Index too high');
	}

	redisClient.hset('values',index,'Nothing yet!');
	redisPublisher.publish('insert',index);
	pgClient.query('INSERT INTO values(number) VALUES($1)',[index]);

	res.send({working:true});
});

app.listen(5000,err=>{
	console.log('Server Listening at port 5000');
});