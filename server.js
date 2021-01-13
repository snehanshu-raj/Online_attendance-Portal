var express  = require('express');
var session  = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var app      = express();
var port     = process.env.PORT || 8080;

var passport = require('passport');
var flash    = require('connect-flash');

require('./config/passport')(passport);

app.use(morgan('dev')); 
app.use(cookieParser()); 
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(bodyParser.json());

app.use(express.static(__dirname + '/Public'));

app.set('view engine', 'ejs'); 

app.use(session({
	secret: 'srj',
	resave: true,
	saveUninitialized: true
 } )); 
app.use(passport.initialize());
app.use(passport.session()); 
app.use(flash()); 

require('./app/routes.js')(app, passport); 

var mysql = require('mysql');
var dbconfig = require('./config/database.js');
var connection = mysql.createConnection(dbconfig.connection);

connection.query('USE ' + dbconfig.database);

var address_array = [];
const fs = require('fs');
var check = require('./app/routes')

var datetime = new Date();
var date = (datetime.toISOString().slice(0,10));

app.get('/markingsheet', function(req, res) {
			res.render("markingsheet", { message : req.flash('message') } );	

})

app.post("/markingsheetaction",  function(req, res){
	
	var sql = 'select status from users where username = ?';
	connection.query(sql, req.body.sub_id, function(error, results) {
		if(error) throw error;
		
		if(results[0].status == 'disable'){
			req.flash('message', "No longer accepting submissions");
			res.redirect("/markingsheet");
		}
		else{
			var student = {
		usn_no : req.body.usn,
		sub_id : req.body.sub_id
	};
	
	console.log("request recieved for : " + req.body.usn);
	const forwarded = req.headers['x-forwarded-for']
	const ip = forwarded ? forwarded.split(/, /)[0] : req.connection.remoteAddress;
	console.log(ip);
	
	var check = "select usn from students where usn = ?";
	var status = "select usn_no from attendance where usn_no = ? and sub_id = ? and presence > ?";
	
	connection.query(status, [req.body.usn, req.body.sub_id, date], function(error, results){
		if (error) throw error;
		console.log(req.body.usn);
		if(results[0] != undefined)
			{
				req.flash('message', "you are already marked present!!");
				res.redirect("/markingsheet");
			}
		else
			{
				connection.query(check, req.body.usn, function(error, results){
					if (error) throw error;
					console.log(results[0]);
					if(results[0] == undefined)
					{
						req.flash('message', "Invalid USN for section B student!!");
						res.redirect("/markingsheet");
					}
					else
					{
						if(address_array.indexOf(ip) > -1)
						{
							req.flash('message', "Proxy Attempted, noted!!");
							console.log(ip);
							res.redirect("/markingsheet");
						}
						else
						{			
							connection.query('insert into attendance set ?', student, function(error, results){
								if (error) throw error;
								console.log(results);
	
								address_array.push(ip);
					
								req.flash('message', "You have been marked present successfully!!");
								
								fs.writeFileSync('status.txt', '');
								
								var entries = 'Presents\n';
								
								connection.query('select distinct usn_no, name from attendance, students where attendance.usn_no = students.usn and sub_id = ? and presence > ?', [req.body.sub_id, date], function(err, rows, fields){ 
									if(err)
									{
         								throw err;
     								}
									else
									{
										for (var i in rows) {
										entries += rows[i].usn_no + '\t';
										entries += rows[i].name + '\n';
										}
										fs.writeFileSync('status.txt', entries, function (err) {
										if (err) 
											console.log('error');
										});
									}
								});
					
								var absentees = '\nAbsents\n';
								
								connection.query('select tot.usn, tot.name from students tot left join attendance marked on tot.usn = marked.usn_no 								where marked.usn_no is null', 	function(err, rows, fields){ 
									if(err)
									{
										throw err;
									}
									else
									{
										for (var i in rows) {
										absentees += rows[i].usn + '\t';
										absentees += rows[i].name + '\n';
										}

										fs.appendFileSync("status.txt", absentees, "UTF-8", {'flags': 'a+'});
									}
								});
								
								res.redirect("/markingsheet");
							});
						}
					}
				});
			}
		});
		}
			
	});
					 
	});
	
app.get('/studentstatus', check.isLoggedIn, function(req, res) {
	var sql = 'select distinct usn_no, name from attendance, students where attendance.usn_no = students.usn and sub_id = ? and presence > ? order by usn_no';

    connection.query(sql, [req.user.username, date], function (err, data, fields) {
    if (err) throw err;
    res.render('student_list', { title: 'Presents', userData: data});
  });
})

app.get('/totalstatus', check.isLoggedIn, function(req, res) {
	var sql = 'SELECT usn_no, count(*) as days FROM attendance where sub_id = ? group by usn_no';

    connection.query(sql, req.user.username, function (err, data, fields) {
    if (err) throw err;
    res.render('student_history', { title: 'Presents', userData: data});
  });
})

app.get('/enable_link', check.isLoggedIn, function(req, res){
	var sql = 'update users set status = "enable" where username = ?'
	connection.query(sql, req.user.username, function (err, data, fields) {
    if (err) throw err;
		res.redirect('/profile');
});
})
	
	app.get('/disable_link', check.isLoggedIn, function(req, res){
	var sql = 'update users set status = "disable" where username = ?'
	connection.query(sql, req.user.username, function (err, data, fields) {
    if (err) throw err;
		res.redirect('/profile');
})
	});
		
app.get('/logout', function(req, res) {
	address_array = [];
	req.logout();
	res.redirect('/');
});

app.listen(port);
console.log('The magic happens on port ' + port)
