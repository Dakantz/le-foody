import bodyParser from 'body-parser';
import express from 'express';
// rest of the code remains same
const app = express();
const PORT = process.env.PORT || 8123;
import { Document, MongoClient } from 'mongodb'
import { Client, PlaceInputType } from "@googlemaps/google-maps-services-js"
const places_key = process.env.PLACES_API_KEY || "AIzaSyAhR0tAWZocf--xAaiLfS21Rdz9Ap961Sc"
const uri = process.env.MONGODB_CONN_STRING || "mongodb://root:devpassword@localhost:27017/";
const mongo = new MongoClient(uri);
const restaurants = mongo.db('le-foody-db').collection('restaurants');
app.get('/', (req, res) => res.send('Le Foody API'));


app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

app.post("/restaurant", (req, res) => {
    (async () => {
        let falstaff_weight = req.body.falstaff_weight || 0.5
        let google_weight = req.body.google_weight || 0.5
        let tripadvisor_weight = req.body.tripadvisor_weight || 0.5
        let skip = req.body.skip || 0;
        let limit = req.body.limit || 50;
        let aggregator_query: Document[] = [
            {
                '$addFields': {
                    'falstaff_rating': {
                        '$filter': {
                            'input': '$ratings',
                            'as': 'rating',
                            'cond': {
                                '$eq': [
                                    '$$rating.rated_by', 'Falstaff'
                                ]
                            }
                        }
                    },
                    'google_rating': {
                        '$filter': {
                            'input': '$ratings',
                            'as': 'rating',
                            'cond': {
                                '$eq': [
                                    '$$rating.rated_by', 'Google'
                                ]
                            }
                        }
                    }
                }
            },
            {
                '$addFields': {
                    'falstaff_rating': {
                        '$first': '$falstaff_rating'
                    },
                    'google_rating': {
                        '$first': '$google_rating'
                    }
                }
            },
            {
                '$addFields': {
                    'falstaff_score': {
                        '$divide': [
                            '$falstaff_rating.score', '$falstaff_rating.score_max'
                        ]
                    },
                    'google_score': {
                        '$divide': [
                            '$google_rating.score', '$google_rating.score_max'
                        ]
                    }
                }
            },
            {
                '$addFields': {
                    'falstaff_weighted': {
                        '$multiply': [
                            '$falstaff_score', falstaff_weight
                        ]
                    },
                    'google_weighted': {
                        '$multiply': [
                            '$google_score', google_weight
                        ]
                    }
                }
            },
            {
                '$addFields': {
                    'complete_sum': {
                        '$add': [
                            '$falstaff_weighted', '$google_weighted'
                        ]
                    }
                }
            }
        ];
        if (req.body.location) {
            let location_query = req.body.location;
            let coords = [location_query.lng, location_query.lat]
            let geo_near: Document = {
                '$geoNear': {
                    'near': {
                        'type': 'Point',
                        'coordinates': coords
                    },
                    'maxDistance': location_query.distance || 10000,
                    'distanceField': 'distance_to_me',
                    'spherical': true
                }
            };
            aggregator_query = [geo_near].concat(aggregator_query);

        }
        let count_query = aggregator_query.concat([
            {
                '$count': 'total'
            }
        ]);
        let final_query = aggregator_query.concat([
            {
                '$sort': {
                    'complete_sum': -1
                }
            },
            {
                $skip: skip
            },
            {
                $limit: limit
            }]);
        let total_agg = await restaurants.aggregate(count_query)
        let total_doc = await total_agg.next()
        let total = total_doc ? total_doc.total || 0 : 0;

        let results_agg = await restaurants.aggregate(final_query);
        let results = await results_agg.toArray();

        res.json({
            total,
            skip,
            limit,
            results,
            message: "Query successful!"
        })

    })().catch(e => {
        console.error(e)
        res.status(400)
        res.json({ error: e + "" })
    })
});


(async () => {

    await mongo.connect();
    app.listen(PORT, () => {
        console.log(`[server]: le-foody Server is running at https://localhost:${PORT}`);
    });

})().catch(e => {
    console.error("Server could not start, exiting!")
    process.exit(-1)
})