/***********************

  Load Components!

  Express      - A Node.js Framework
  Body-Parser  - A tool to help use parse the data in a post request
  Pug          - A view engine for dynamically rendering HTML pages
  Pg-Promise   - A database tool to help use connect to our PostgreSQL database

***********************/

const express = require('express'); // Add the express framework has been added
let app = express();

const bodyParser = require('body-parser'); // Add the body-parser tool has been added
app.use(bodyParser.json());              // Add support for JSON encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // Add support for URL encoded bodies

const pug = require('pug'); // Add the 'pug' view engine

//Create Database Connection
const pgp = require('pg-promise')();


/**********************

  Database Connection information

  host: This defines the ip address of the server hosting our database.  We'll be using localhost and run our database on our local machine (i.e. can't be access via the Internet)
  port: This defines what port we can expect to communicate to our database.  We'll use 5432 to talk with PostgreSQL
  database: This is the name of our specific database.  From our previous lab, we created the football_db database, which holds our football data tables
  user: This should be left as postgres, the default user account created when PostgreSQL was installed
  password: This the password for accessing the database.  You'll need to set a password USING THE PSQL TERMINAL THIS IS NOT A PASSWORD FOR POSTGRES USER ACCOUNT IN LINUX!

**********************/
// REMEMBER to chage the password

const dbConfig = {
	host: 'localhost',
	port: 5432,
	database: 'football_db',
	user: 'postgres',
	password: '8785320'
};

let db = pgp(dbConfig);

// set the view engine to ejs
app.set('view engine', 'pug');
app.use(express.static(__dirname + '/')); // This line is necessary for us to use relative paths and access our resources directory


// login page
app.get('/login', function(req, res) {
	res.render('pages/login',{
		local_css:"signin.css",
		my_title:"Login Page"
	});
});

// registration page
app.get('/register', function(req, res) {
	res.render('pages/register',{
		my_title:"Registration Page"
	});
});

app.get('/home', function(req, res) {
	var query = 'select * from favorite_colors;';
	db.any(query)
        .then(function (rows) {
            res.render('pages/home',{
				my_title: "Home Page",
				data: rows,
				color: '',
				color_msg: ''
			})

        })
        .catch(function (err) {
            // display error message in case an error
            req.flash('error', err); //if this doesn't work for you replace with console.log
            res.render('pages/home', {
                title: 'Home Page',
                data: '',
                color: '',
                color_msg: ''
            })
        })
});

app.get('/home/pick_color', function(req, res) {
	var color_choice = req.query.color_selection;
	var color_options =  'select * from favorite_colors;';
	var color_message = "select color_msg from favorite_colors where hex_value = '" + color_choice + "';";
	db.task('get-everything', task => {
        return task.batch([
            task.any(color_options),
            task.any(color_message)
        ]);
    })
    .then(info => {
    	res.render('pages/home',{
				my_title: "Home Page",
				data: info[0],
				color: color_choice,
				color_msg: info[1][0].color_msg
			})
    })
    .catch(error => {
        // display error message in case an error
            req.flash('error', error);//if this doesn't work for you replace with console.log
            res.render('pages/home', {
                title: 'Home Page',
                data: '',
                color: '',
                color_msg: ''
            })
    });

});

app.post('/home/pick_color', function(req, res) {
	var color_hex = req.body.color_hex;
	var color_name = req.body.color_name;
	var color_message = req.body.color_message;
	var insert_statement = "INSERT INTO favorite_colors(hex_value, name, color_msg) VALUES('" + color_hex + "','" +
							color_name + "','" + color_message +"') ON CONFLICT DO NOTHING;";

	var color_select = 'select * from favorite_colors;';
	db.task('get-everything', task => {
        return task.batch([
            task.any(insert_statement),
            task.any(color_select)
        ]);
    })
    .then(info => {
    	res.render('pages/home',{
				my_title: "Home Page",
				data: info[1],
				color: color_hex,
				color_msg: color_message
			})
    })
    .catch(error => {
        // display error message in case an error
            req.flash('error', error); //if this doesn't work for you replace with console.log
            res.render('pages/home', {
                title: 'Home Page',
                data: '',
                color: '',
                color_msg: ''
            })
    });
});

app.get('/team_stats', function(req, res){
	var games_query = "SELECT football_games.*, (CASE WHEN home_score > visitor_score THEN 'CU Boulder' ELSE visitor_name END) AS winner FROM football_games ORDER BY game_date";
	db.task('load-team-stats', task =>
		task.batch([
			task.any(games_query),
			task.any("SELECT COUNT(*) AS games_won FROM football_games WHERE home_score > visitor_score"),
			task.any("SELECT COUNT(*) AS games_lost FROM football_games WHERE home_score < visitor_score")
		])
	)
	.then(query_results => {
		res.render(
			'pages/team_stats',
			{
				my_title: 'Team Stats',
				gamesList: query_results[0],
				gamesWon: query_results[1][0].games_won,
				gamesLost: query_results[2][0].games_lost
			}
		)
	})
	.catch(error => {
		console.log('error', err);
		request.flash('error', err);
		response.render('pages/home', {
			title: 'Home Page',
			data: '',
			color: '',
			color_msg: ''
		})
	});
});

app.get('/player_info', function(req, res){
	db.task('load-players', task =>
		task.any("SELECT * FROM football_players ORDER BY id")
	).then( query_result =>
		res.render(
			'pages/player_info',
			{
				my_title: 'Player Info',
				players: query_result,
				selected_player: null
			}
		)
	).catch(error => {
		console.log('error', err);
		request.flash('error', err);
		response.render('pages/home', {
			title: 'Home Page',
			data: '',
			color: '',
			color_msg: ''
		})
	});
});

app.get('/player_info/select_player', function(req, res){
	var id = parseInt(req.query.player_choice || 0);
	db.task('load-players', task =>
		task.batch([
			// load the list of all players then the selected player.
			task.any("SELECT * FROM football_players ORDER BY id"),
			task.oneOrNone("SELECT * FROM football_players WHERE id=$1", id)
		]).then(results => {
			var selectedPlayer = results[1];
			var gameCountResult = null;
			if(selectedPlayer){
				gameCountResult = task.one("SELECT count(*) AS games_played FROM football_games WHERE $1 = ANY(players)", selectedPlayer.id)
			}
			return Promise.all([Promise.resolve(results[0]), Promise.resolve(selectedPlayer), gameCountResult]);
		}).catch(err => {
			console.log("query error", err)
		})
	).then(query_results => {
		var selected_player = query_results[1];
		selected_player.games_played = query_results[2].games_played;
		res.render(
			'pages/player_info',
			{
				my_title: 'Player Info -- ' + selected_player.name,
				players: query_results[0],
				selected_player: selected_player
			}
		)
	}).catch(error => {
		console.log('error', err);
		request.flash('error', err);
		response.render('pages/home', {
			title: 'Home Page',
			data: '',
			color: '',
			color_msg: ''
		})
	});
});



app.listen(3000);
console.log('3000 is the magic port');
