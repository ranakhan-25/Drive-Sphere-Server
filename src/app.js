require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
const uri = process.env.DB_URL;

const app = express();

app.use(cors());
app.use(express.json());
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);
const verifyToken = async (req, res, next) => {
  try {
    const header = req?.headers?.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Unauthorized Access",
        status: 401,
      });
    }

    // Extract token
    const token = header.split(" ")[1];

    // Verify token
    try {
      const { payload } = await jwtVerify(token, JWKS);
      next();
    } catch (error) {
      res.json({
        message: error.message,
        status: 500,
      });
    }
  } catch (error) {
    return res.status(401).json({
      message: error.message,
      status: 401,
    });
  }
};

async function run() {
  try {
   
    const db = client.db("cars");
    const carsCollection = db.collection("carsCollection");
    const BookingCollection = db.collection("booking");

    app.get("/api/cars", async (req, res) => {
      try {
        const search = req.query.search || "";
        const type = req.query.type || "";

        let query = {};

        // Search by carName
        if (search) {
          query.carName = {
            $regex: search,
            $options: "i",
          };
        }

        // Filter by carType
        if (type) {
          query.carType = {
            $regex: type,
            $options: "i",
          };
        }

        const result = await carsCollection.find(query).toArray();

        res.send({
          success: true,
          payload: result,
        });
      } catch (error) {
        console.log(error);

        res.send({
          success: false,
          payload: [],
        });
      }
    });

    app.delete("/api/cars/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        // Check valid ObjectId
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid car id",
          });
        }

        // Delete Car
        const result = await carsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        // If not found
        if (result.deletedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Car not found",
          });
        }

        // Success Response
        res.send({
          success: true,
          message: "Car deleted successfully",
          deletedCount: result.deletedCount,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    });

    app.post("/api/add-car", verifyToken, async (req, res) => {
      try {
        const data = req.body;
        const newCar = {
          carName: data.carName,
          dailyRentPrice: data.dailyRentPrice,
          carType: data.carType,
          imageUrl: data.imageUrl,
          seatCapacity: data.seatCapacity,
          description: data.description,
          availabilityStatus: data.availabilityStatus,
        };

        const result = await carsCollection.insertOne(newCar);
        if (!result) {
          return res.json({
            message: "car insert not successfully",
            status: 500,
          });
        }
        res.json({
          message: "car created successfully",
          payload: result,
        });
      } catch (error) {
        res.json({
          message: error.message,
          status: 500,
        });
      }
    });

    app.get("/api/cars/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;

        const result = await carsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!result) {
          return res.status(404).json({
            message: "Car not found with this ID",
          });
        }

        res.status(200).json({
          message: "Car found successfully",
          payload: result,
        });
      } catch (error) {
        res.status(500).json({
          message: error.message,
        });
      }
    });

    app.patch("/api/cars/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const updatedData = req.body;

        const result = await carsCollection.findOneAndUpdate(
          { _id: new ObjectId(id) },
          { $set: updatedData },
          { returnDocument: "after" },
        );

        if (!result) {
          return res.status(404).json({
            message: "Car not found",
            status: 404,
          });
        }

        res.json({
          message: "Car updated successfully",
          status: 200,
          payload: result,
        });
      } catch (error) {
        res.status(500).json({
          message: error.message,
          status: 500,
        });
      }
    });

    app.post("/api/booking", verifyToken, async (req, res) => {
      try {
        const data = req.body;

        // Save Booking
        const result = await BookingCollection.insertOne(data);

        if (!result.insertedId) {
          return res.status(500).json({
            message: "Car booking not successful",
            status: 500,
          });
        }

        // Increase booking_count
        await carsCollection.updateOne(
          {
            _id: new ObjectId(data.carId),
          },
          {
            $inc: {
              booking_count: 1,
            },
          },
        );

        res.json({
          message: "Car booking successful",
          payload: result,
        });
      } catch (error) {
        res.status(500).json({
          message: error.message,
          status: 500,
        });
      }
    });

    app.get("/api/booking/:userId", verifyToken, async (req, res) => {
      try {
        const { userId } = req.params;
        const result = await BookingCollection.find({ userId }).toArray();

        if (!result) {
          return res.json({
            message: "booking car are not found",
            status: 404,
          });
        }

        res.json({
          message: "car found successfully",
          payload: result,
        });
      } catch (error) {
        res.status(500).json({
          message: error.message,
          status: 500,
        });
      }
    });

    app.delete("/api/booking/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const result = await BookingCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (!result) {
          return res.json({
            message: "booking car can not deleted",
            status: 500,
          });
        }
        res.json({
          message: "deleted successfully",
          payload: result,
        });
      } catch (error) {
        res.status(500).json({
          message: error.message,
          status: 500,
        });
      }
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {

  }
}
run().catch(console.dir);

app.get("/", async (req, res) => {
  try {
    res.status(200).send("<h1>Welcome to server</h1>");
  } catch (error) {
    res.json({
      message: error.message,
      status: 400,
    });
  }
});

module.exports = app;
