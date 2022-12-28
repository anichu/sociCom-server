const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const cors = require("cors");
const app = express();
const morgan = require("morgan");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
// middleware
app.use(cors());
app.use(express.json());

if (process.env.NODE_DEV === "development") {
	app.use(morgan("dev"));
}

const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.wjvzlqr.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	serverApi: ServerApiVersion.v1,
});

function verifyJwt(req, res, next) {
	const authHeader = req.headers.authorization;

	if (!authHeader) {
		return res.status(401).send({ message: "Unauthorized access" });
	}

	const token = authHeader.split(" ")[1];
	jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
		console.log(err);
		if (err) {
			return res.status(403).send({ message: "Forbidden access" });
		}
		req.decoded = decoded;
		next();
	});
}

function verifyJwt(req, res, next) {
	const authHeader = req.headers.authorization;

	if (!authHeader) {
		return res.status(401).send({ message: "Unauthorized access" });
	}

	const token = authHeader.split(" ")[1];
	jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
		console.log(err);
		if (err) {
			return res.status(403).send({ message: "Forbidden access" });
		}
		req.decoded = decoded;
		next();
	});
}

async function run() {
	try {
		const postsCollection = client.db("sociCom").collection("posts");
		const usersCollection = client.db("sociCom").collection("users");
		const categoriesCollection = client.db("sociCom").collection("categories");
		const bookingCollection = client.db("sociCom").collection("bookings");
		const paymentCollection = client.db("sociCom").collection("payments");
		const wishListCollection = client.db("sociCom").collection("wishLists");

		app.get("/", async (req, res) => {
			res.send("Server is running on port 🚀🚀🚀🚀");
		});

		app.get("/user/jwt", async (req, res) => {
			const email = req.query.email;

			const query = {
				email: email,
			};

			const user = await usersCollection.findOne(query);
			console.log("jwt", user);
			let token;
			if (user) {
				token = jwt.sign({ email }, process.env.JWT_SECRET, {
					expiresIn: "7d",
				});
				return res.send({ accessToken: token });
			}

			res.status(403).send({ accessToken: token });
		});
		// create user
		app.post("/users", async (req, res) => {
			const user = req.body;
			const result = await usersCollection.insertOne(user);
			res.send(result);
		});
		// get user by query email
		app.get("/user", async (req, res) => {
			const email = req.query.email;
			const query = {
				email,
			};
			const result = await usersCollection.findOne(query);
			res.send(result);
		});

		// create user when login with google
		app.post("/users/google", async (req, res) => {
			const data = req.body;
			const query = {
				email: data.email,
			};

			const user = await usersCollection.findOne(query);
			let result;
			if (!user) {
				result = await usersCollection.insertOne(data);
			} else {
				const updateDoc = {
					$set: {
						...data,
					},
				};
				const options = {
					upsert: true,
				};
				result = await usersCollection.updateOne(query, updateDoc, options);
			}
			res.send(result);
		});

		// create posts
		app.post("/posts", verifyJwt, async (req, res) => {
			const data = req.body;
			const createPost = {
				...data,
				createdDate: new Date(),
			};
			const result = await postsCollection.insertOne(createPost);
			res.send(result);
		});
		// get all posts
		app.get("/posts", async (req, res) => {
			const query = {};
			const result = await postsCollection
				.find(query)
				.sort({ createdDate: -1 })
				.toArray();
			res.send(result);
		});

		// create comment

		app.post("/comment/:id", async (req, res) => {
			const data = req.body;
			const createComment = {
				_id: new ObjectId(),
				...data,
				createdDate: new Date(),
			};
			const id = req.params.id;
			const query = {
				_id: ObjectId(id),
			};
			try {
				const post = await postsCollection.findOne(query);
				const comments = post.comments.unshift({ name: "anis" });
				console.log(comments);
				const options = { upsert: true };
				const updateDoc = {
					$push: { comments: { $each: [createComment], $position: 0 } },
				};
				const result = await postsCollection.updateOne(
					query,
					updateDoc,
					options
				);
				res.send(result);
			} catch (error) {
				res.send(error.message);
			}
		});

		// get products by id
		app.get("/products/book/:id", async (req, res) => {
			const id = req.params.id;
			const query = {
				_id: ObjectId(id),
			};
			const result = await phonesCollection.findOne(query);
			res.send(result);
		});
		// delete my products
		app.delete("/myproducts/:id", verifyJwt, async (req, res) => {
			const id = req.params.id;
			const query = {
				_id: ObjectId(id),
			};
			const result = await phonesCollection.deleteOne(query);
			res.send(result);
		});
		// get categories
		app.get("/categories", async (req, res) => {
			const result = await categoriesCollection.find({}).toArray();
			res.send(result);
		});

		// get advertised products
		app.get("/products/advertised", async (req, res) => {
			const query = {
				isAvailable: true,
				isAdvertised: true,
			};
			const result = await phonesCollection.find(query).toArray();
			res.send(result);
		});
		// get all buyers
		app.get("/allbuyers", verifyJwt, async (req, res) => {
			const query = {
				role: "buyer",
			};
			const result = await usersCollection.find(query).toArray();
			res.send(result);
		});
		// buyer delete
		app.delete("/user/buyer/:id", async (req, res) => {
			const id = req.params.id;
			const query = {
				_id: ObjectId(id),
			};
			const result = await usersCollection.deleteOne(query);
			res.send(result);
		});

		app.get("/allsellers", verifyJwt, async (req, res) => {
			const query = {
				role: "seller",
			};
			const result = await usersCollection.find(query).toArray();
			res.send(result);
		});

		// get products by categories
		app.get("/products/:category", async (req, res) => {
			const category = req.params.category;
			const query = {
				category: category,
				isAvailable: true,
			};
			const products = await phonesCollection
				.find(query)
				.sort({ createdDate: -1 })
				.toArray();
			res.send(products);
		});

		app.get("/latestproducts", async (req, res) => {
			const query = {
				isAvailable: true,
				isAdvertised: false,
			};

			const result = await phonesCollection
				.find(query)
				.limit(6)
				.sort({ createdDate: -1 })
				.toArray();

			res.send(result);
		});

		// verify api
		app.put("/user/seller/verify/:id", verifyJwt, async (req, res) => {
			const id = req.params.id;
			const filter = {
				_id: ObjectId(id),
			};
			const updatedDoc = {
				$set: {
					isVerified: true,
				},
			};
			const options = {
				upsert: true,
			};

			const result = await usersCollection.updateOne(
				filter,
				updatedDoc,
				options
			);
			console.log(result);
			res.send(result);
		});

		// delete seller
		app.delete("/user/seller/:id", verifyJwt, async (req, res) => {
			const id = req.params.id;
			const query = {
				_id: ObjectId(id),
			};
			const result = await usersCollection.deleteOne(query);
			res.send(result);
		});

		app.post("/booking", async (req, res) => {
			const data = req.body;
			const currentBooking = {
				...data,
				created: new Date(),
				isPaid: false,
			};
			const result = await bookingCollection.insertOne(currentBooking);
			res.send(result);
		});
		app.get("/user/buyer/bookings", verifyJwt, async (req, res) => {
			const email = req?.query?.email;

			if (email !== req.decoded.email) {
				return res.status(403).send({ message: "access forbidden" });
			}

			// const paymentPhoneId = await paymentCollection
			// 	.find({})
			// 	.project({ phoneId: 1 });

			const query = {
				email,
			};
			const result = await bookingCollection
				.find(query)
				.sort({ created: -1 })
				.toArray();
			res.send(result);
		});

		app.get("/user/buyer/bookings/:id", async (req, res) => {
			const id = req.params.id.trim();
			const query = {
				_id: ObjectId(id),
			};
			const result = await bookingCollection.findOne(query);
			res.send(result);
		});

		app.post("/create-payment-intent", async (req, res) => {
			const booking = req.body;
			const price = booking.price;
			const amount = price * 100;

			const paymentIntent = await stripe.paymentIntents.create({
				currency: "usd",
				amount: amount,
				payment_method_types: ["card"],
			});
			res.send({
				clientSecret: paymentIntent.client_secret,
			});
		});

		app.post("/payments", async (req, res) => {
			const data = req.body;
			const { email, transactionId, productId, booking } = data;
			const currentPayment = {
				transactionId,
				booking,
				email,
				productId,
			};
			console.log(data);
			const paymentResult = await paymentCollection.insertOne(currentPayment);
			if (paymentResult.acknowledged) {
				const filterBooking = {
					_id: ObjectId(booking),
				};
				const filterPhones = {
					_id: ObjectId(productId),
				};
				const options = {
					upsert: true,
				};
				const updateBooking = {
					$set: {
						isPaid: true,
					},
				};

				const updatePhones = {
					$set: {
						isAvailable: false,
					},
				};

				const bookingResult = await bookingCollection.updateOne(
					filterBooking,
					updateBooking,
					options
				);
				const phoneResult = await phonesCollection.updateOne(
					filterPhones,
					updatePhones,
					options
				);
				console.log(phoneResult);
			}

			res.send(paymentResult);
		});
		// whether product is sold  or not
		app.get("/payments/:id", async (req, res) => {
			const productId = req.params.id;
			const query = {
				productId,
			};
			const result = await paymentCollection.findOne(query);
			res.send(result);
		});

		app.post("/mywishlist", async (req, res) => {
			const data = req.body;
			const currentWishList = {
				...data,
				created: new Date(),
				isBooked: false,
			};
			const result = await wishListCollection.insertOne(currentWishList);
			res.send(result);
		});

		app.get("/mywishlist/:id", async (req, res) => {
			const id = req.params.id;
			const query = {
				_id: ObjectId(id),
			};
			const updateDoc = {
				$set: {
					isBooked: true,
				},
			};

			const options = {
				upsert: true,
			};
			const result = await wishListCollection.updateOne(
				query,
				updateDoc,
				options
			);
			res.send(result);
		});

		app.get("/user/mywishlist", verifyJwt, async (req, res) => {
			const email = req?.decoded?.email;
			console.log("wish", email);
			const query = {
				email,
				isBooked: false,
			};
			const result = await wishListCollection
				.find(query)
				.sort({ created: -1 })
				.toArray();
			res.send(result);
		});
		// app.get("/users/verified", async (req, res) => {
		// 	const filter = {};
		// 	const options = {
		// 		upsert: true,
		// 	};
		// 	const updateDoc = {
		// 		$set: {
		// 			isVerified: false,
		// 		},
		// 	};
		// 	try {
		// 		const result = await usersCollection.updateMany(filter, updateDoc);
		// 		console.log(result);
		// 		res.send(result);
		// 	} catch (err) {
		// 		console.log(err);
		// 	}
		// });
	} catch (err) {
		console.log(err);
	}
}

run().catch((err) => console.log(err));

app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
