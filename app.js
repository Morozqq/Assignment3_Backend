const express = require("express");
const https = require("https");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const session = require("express-session");

const app = express();

app.use(
    session({
        secret: "dsadsafewdrewe21312sads",
        resave: true,
        saveUninitialized: true,
    })
);

mongoose.connect(
    "mongodb+srv://aslandzheleubaj04:523435523435Aa@cluster0.duzkl5t.mongodb.net/weatherApp",
    {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    }
);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set("views", __dirname + "/"); // Set the correct views directory path
app.set("view engine", "ejs");

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => console.log("Connected to MongoDB Atlas"));

app.use(bodyParser.urlencoded({ extended: true }));

const User = mongoose.model("User", {
    username: String,
    password: String,
    isAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    deletedAt: Date,
});

const RequestHistory = mongoose.model("RequestHistory", {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    requestType: String, // e.g., "weather", "latlon", "countrydata", "chucknorris"
    requestData: Object, // User input or request data
    responseData: Object, // API response data
    timestamp: { type: Date, default: Date.now },
});

app.get("/", (req, res) => {
    const isAuthenticated = req.session.user ? true : false;
    const user = isAuthenticated ? req.session.user : null;
    res.render("index", { user });
});

app.get("/country", (req, res) => {
    const isAuthenticated = req.session.user ? true : false;
    const user = isAuthenticated ? req.session.user : null;

    res.render("country", { user });
});

app.get("/chack", (req, res) => {
    const isAuthenticated = req.session.user ? true : false;
    const user = isAuthenticated ? req.session.user : null;

    res.render("faceit", { user });
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username, password });

        if (!user) {
            res.redirect("/login");
            return;
        }

        req.session.user = user;

        if (user.isAdmin) {
            res.redirect("/admin");
        } else {
            res.redirect("/user");
        }
    } catch (error) {
        console.error(error);
        res.redirect("/login");
    }
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", async (req, res) => {
    const { username, password } = req.body;

    try {
        const existingUser = await User.findOne({ username });

        if (existingUser) {
            res.redirect("/register");
            return;
        }

        const newUser = new User({ username, password });
        await newUser.save();

        req.session.user = newUser;

        res.redirect("/user");
    } catch (error) {
        console.error(error);
        res.redirect("/register");
    }
});

app.get("/user", async (req, res) => {
    if (!req.session.user || !req.session.user.username) {
        res.redirect("/login");
        return;
    }

    try {
        const userId = req.session.user._id;
        const username = req.session.user.username;

        // Fetch user's request history
        const historyData = await RequestHistory.find({ userId })
            .sort({ timestamp: -1 })
            .limit(10);

        res.render("user", { username, historyData });
    } catch (error) {
        console.error("Error fetching request history:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/admin", async (req, res) => {
    try {
        const users = await User.find();

        const isAuthenticatedAdmin =
            req.session.user && req.session.user.isAdmin;

        if (!isAuthenticatedAdmin) {
            res.redirect("/login");
            return;
        }

        res.render("admin", { username: req.session.user.username, users });
    } catch (error) {
        console.error(error);
        res.redirect("/login");
    }
});

// Handle creating a new user
app.post("/admin/create", async (req, res) => {
    const { newUsername, newPassword } = req.body;

    try {
        const newUser = new User({
            username: newUsername,
            password: newPassword,
        });
        await newUser.save();
        res.redirect("/admin");
    } catch (error) {
        console.error(error);
        res.redirect("/admin");
    }
});

// Handle editing a user
app.route("/admin/edit/:userId")
    .get(async (req, res) => {
        const userId = req.params.userId;

        try {
            const userToEdit = await User.findById(userId);

            if (!userToEdit) {
                res.redirect("/admin");
                return;
            }

            // Render a form for editing the user
            res.render("editUser", { user: userToEdit });
        } catch (error) {
            console.error(error);
            res.redirect("/admin");
        }
    })
    .post(async (req, res) => {
        const userId = req.params.userId;
        const { newUsername, newPassword } = req.body;

        try {
            const userToEdit = await User.findById(userId);

            if (userToEdit) {
                userToEdit.username = newUsername;

                // Update the password only if a new password is provided
                if (newPassword) {
                    userToEdit.password = newPassword;
                }

                await userToEdit.save();
            }

            res.redirect("/admin");
        } catch (error) {
            console.error(error);
            res.redirect("/admin");
        }
    });

// Handle deleting a user
app.get("/admin/delete/:userId", async (req, res) => {
    const userId = req.params.userId;

    try {
        await User.findByIdAndDelete(userId);
        res.redirect("/admin");
    } catch (error) {
        console.error(error);
        res.redirect("/admin");
    }
});
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

// Function to get weather data by city
function getWeatherByCity(city, res, userId) {
    const url =
        "https://api.openweathermap.org/data/2.5/weather?q=" +
        city +
        "&appid=794f6646c3546306ac4be1843ed38e2a&units=metric";

    https.get(url, function (response) {
        console.log(response.statusCode);

        response.on("data", function (data) {
            const weatherdata = JSON.parse(data);
            displayWeatherData(res, weatherdata, userId);
        });
    });
}

// Function to get weather data by latitude and longitude
function getWeatherByLatLon(lat, lon, res) {
    const url =
        "https://api.openweathermap.org/data/2.5/weather?lat=" +
        lat +
        "&lon=" +
        lon +
        "&appid=794f6646c3546306ac4be1843ed38e2a&units=metric";

    https.get(url, function (response) {
        console.log(response.statusCode);
        response.on("data", function (data) {
            const weatherdata = JSON.parse(data);
            displayWeatherData(res, weatherdata);
        });
    });
}

async function saveRequestHistory(
    userId,
    requestType,
    requestData,
    responseData
) {
    const requestHistory = new RequestHistory({
        userId: userId,
        requestType: requestType,
        requestData: requestData,
        responseData: responseData,
    });

    try {
        await requestHistory.save();
    } catch (error) {
        console.error("Error saving request history:", error);
        throw error; // Re-throw the error to be caught by the calling function
    }
}
// Function to display weather data
function displayWeatherData(res, weatherdata, userId) {
    const city = weatherdata.name;
    const temp = weatherdata.main.temp;
    const feelsLike = weatherdata.main.feels_like;
    const description = weatherdata.weather[0].description;
    const icon = weatherdata.weather[0].icon;
    const imgURL = "https://openweathermap.org/img/wn/" + icon + "@2x.png";
    const coordinates = weatherdata.coord;
    const humidity = weatherdata.main.humidity;
    const pressure = weatherdata.main.pressure;
    const windSpeed = weatherdata.wind.speed;
    const countryCode = weatherdata.sys.country;
    const rainVolume = weatherdata.rain ? weatherdata.rain["3h"] || 0 : 0;

    // Store request and response data in MongoDB
    const requestData = { city };
    const responseData = {
        temperature: temp,
        description: description,
        iconURL: imgURL,
        feelsLike: feelsLike,
        coordinates: coordinates,
        humidity: humidity,
        pressure: pressure,
        windSpeed: windSpeed,
        countryCode: countryCode,
        rainVolume: rainVolume,
    };

    // Save the request history
    try {
        saveRequestHistory(userId, "weather", requestData, responseData);
        // Send a JSON response
        res.json(responseData);
    } catch (error) {
        console.error("Error handling request history:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

// Function to get country data by name
function getCountryData(countryName, res, userId) {
    const apiUrl = `https://restcountries.com/v3.1/name/${countryName}`;

    // Make an HTTP GET request
    const req = https.get(apiUrl, (response) => {
        let data = "";

        response.on("data", (chunk) => {
            data += chunk;
        });

        response.on("end", () => {
            try {
                const countryData = JSON.parse(data)[0]; // Assuming the first result if there are multiple matches
                displayCountryData(res, countryData, userId);
            } catch (error) {
                console.error("Error parsing country data:", error.message);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });
    });

    // Handle errors during the HTTP request
    req.on("error", (error) => {
        console.error("Error fetching country data:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    });

    req.end();
}

// Function to display country data
async function displayCountryData(res, countryData, userId) {
    console.log("Country Data:", countryData);

    // Store request and response data in MongoDB
    const requestData = { countryName: countryData.name.common };
    const responseData = { countryData };

    // Save the request history
    try {
        await saveRequestHistory(
            userId,
            "countrydata",
            requestData,
            responseData
        );
        // Send a JSON response
        res.json(countryData);
    } catch (error) {
        console.error("Error handling request history:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}

// Function to get Chuck Norris joke
function getChuckNorrisJoke(res, userId) {
    const chuckNorrisUrl = "https://api.chucknorris.io/jokes/random";

    https.get(chuckNorrisUrl, function (response) {
        console.log(response.statusCode);

        response.on("data", function (data) {
            const jokeData = JSON.parse(data);

            // Store request and response data in MongoDB
            const requestData = {};
            const responseData = { joke: jokeData.value };

            // Save the request history
            saveRequestHistory(
                userId,
                "chucknorris",
                requestData,
                responseData
            );

            res.json({ joke: jokeData.value });
        });
    });
}

// Route for Chuck Norris joke
app.get("/chucknorris", (req, res) => {
    const userId = req.session.user ? req.session.user._id : null;
    getChuckNorrisJoke(res, userId);
});

// Route for city weather
app.post("/weather", (req, res) => {
    const city = req.body.city;
    const userId = req.session.user ? req.session.user._id : null; // Retrieve userId from the session

    // Pass userId to getWeatherByCity function
    getWeatherByCity(city, res, userId);
});

// Route for latitude and longitude weather
app.post("/latlon", (req, res) => {
    const lat = req.body.lat;
    const lon = req.body.lon;
    getWeatherByLatLon(lat, lon, res);
});

// Route for country data
app.post("/countrydata", (req, res) => {
    const countryName = req.body.countryName;
    const userId = req.session.user ? req.session.user._id : null; // Retrieve userId from the session

    // Pass userId to getCountryData function
    getCountryData(countryName, res, userId);
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
