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

		// update user
		app.put("/user", async (req, res) => {
			const email = req.query.email;
			const query = {
				email,
			};
			const { name, university, city, address, dateOfBirth, gender } = req.body;
			const options = { upsert: true };

			const updateDoc = {
				$set: {
					name,
					university,
					city,
					address,
					dateOfBirth,
					gender,
				},
			};
			const result = await usersCollection.updateOne(query, updateDoc, options);
			res.send(result);
		});

		// update user image
		app.put("/user/image", async (req, res) => {
			console.log(req.body.image);
			const email = req.query.email;
			const query = {
				email,
			};
			const options = { upsert: true };
			const updateDoc = {
				$set: {
					image: req.body.image,
				},
			};
			const result = await usersCollection.updateOne(query, updateDoc, options);
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

		// get myposts by email
		app.get("/myposts", async (req, res) => {
			const email = req.query.email;
			const query = {
				email,
			};
			const result = await postsCollection
				.find(query)
				.sort({ createdDate: -1 })
				.toArray();
			res.send(result);
		});

		// get post by id
		app.get("/post/:id", async (req, res) => {
			const id = req.params.id;
			const query = {
				_id: ObjectId(id),
			};
			const result = await postsCollection.findOne(query);
			res.send(result);
		});

		// create liked
		app.post("/post/like/:id", async (req, res) => {
			const data = req.body;
			const createReact = {
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
				const likes = post?.likes?.find((like) => like.email === data.email);

				if (!likes) {
					const options = { upsert: true };
					const updateDoc = {
						$push: { likes: { $each: [createReact], $position: 0 } },
					};
					const result = await postsCollection.updateOne(
						query,
						updateDoc,
						options
					);
					return res.send(createReact);
				} else {
					const result = await postsCollection.updateOne(
						{
							_id: ObjectId(id),
							"likes.email": data.email,
						},
						{
							$set: {
								"likes.$.like": data.like,
							},
						}
					);
					return res.send({ ...createReact, _id: likes._id });
				}
			} catch (error) {
				res.send(error.message);
			}
		});

		// delete like
		app.get("/post/like/delete", async (req, res) => {
			const postId = req.query.postId;
			const likeId = req.query.likeId;
			const email = req.query.email;
			const query = { _id: ObjectId(postId) };

			try {
				const post = await postsCollection.findOne(query);
				const likes = post?.likes?.find((like) => like.email === email);
				if (likes) {
					const result = await postsCollection.updateOne(
						query,
						{
							$pull: {
								likes: {
									_id: ObjectId(likeId),
								},
							},
						},
						{ new: true }
					);
					return res.send(result);
				}
				res.send(post);
			} catch (error) {
				console.log(error.message);
				res.send(error.message);
			}
		});

		app.get("/post/like/total/:id", async (req, res) => {
			const query = {
				_id: ObjectId(req.params.id),
			};
			const post = await postsCollection.findOne(query);
			let like = 0;
			let love = 0;
			for (let i = 0; i < post.likes.length; i++) {
				if (post.likes[i].like === "like") {
					like++;
				} else if (post.likes[i].like === "love") {
					love++;
				}
			}
			res.send({
				like,
				love,
			});
		});
		// get post by id
		app.get("/post/:id", async (req, res) => {
			const id = req.params.id;
			const query = {
				_id: ObjectId(id),
			};
			const result = await postsCollection.findOne(query);
			res.send(result);
		});

		app.get("/popular", async (req, res) => {
			const query = {};
			const result = await postsCollection
				.find(query)
				.sort({ createdDate: -1 })
				.toArray();
			let array = [];
			for (let i = 0; i < result.length; i++) {
				const obj = result[i];
				array.push({ ...obj, size: obj.likes.length });
			}
			console.log(array);

			function compare(a, b) {
				if (a.size > b.size) {
					return -1;
				}
				if (a.size < b.size) {
					return 1;
				}
				return 0;
			}
			array.sort(compare);
			res.send(array.slice(0, 3));
		});
	} catch (err) {
		console.log(err);
	}
}

run().catch((err) => console.log(err));

app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
