import bodyParser from 'body-parser';
import express from 'express';
import cors from "cors"
// rest of the code remains same
const app = express();
const PORT = process.env.PORT || 8123;
import { Document, MongoClient } from 'mongodb'
import { Client, FindPlaceFromTextResponse, PlaceInputType } from "@googlemaps/google-maps-services-js"
const places_key = process.env.PLACES_API_KEY || "AIzaSyAhR0tAWZocf--xAaiLfS21Rdz9Ap961Sc"
const uri = process.env.MONGODB_CONN_STRING || "mongodb://root:devpassword@localhost:27017/";
const mongo = new MongoClient(uri);
const restaurants = mongo.db('le-foody-db').collection('restaurants');
app.get('/', (req, res) => res.send('Le Foody API'));


app.use(bodyParser.urlencoded({ extended: false }))

app.use(cors())
// parse application/json
app.use(bodyParser.json())
let gclient = new Client();
app.get("/location-search", (req, res) => {
    (async () => {
        let places: FindPlaceFromTextResponse;
        if (!req.query.query) {
            throw Error("Please add a valid query!")
        }
        let query = (req.query.query + "") || "";
        try {
            places = await gclient.findPlaceFromText({
                params: {
                    key: places_key,
                    input: query,
                    inputtype: PlaceInputType.textQuery,
                    fields: ["name", "geometry"]
                }
            })
            res.json({ candidates: places.data.candidates })
        } catch {
            console.warn("Failed to reverse-search for ", query)
            throw Error("Please add a valid query!")

        }
    })().catch(e => {
        console.error(e)
        res.status(400)
        res.json({ message: e + "" })
    })
});
app.post("/restaurants", (req, res) => {
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
                    },
                    'tripadvisor_rating': {
                        '$filter': {
                            'input': '$ratings',
                            'as': 'rating',
                            'cond': {
                                '$eq': [
                                    '$$rating.rated_by', 'Tripadvisor'
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
                    },
                    'tripadvisor_rating': {
                        '$first': '$tripadvisor_rating'
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
                    },
                    'tripadvisor_score': {
                        '$divide': [
                            '$tripadvisor_rating.score', '$tripadvisor_rating.score_max'
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
                    },
                    'tripadvisor_weighted': {
                        '$multiply': [
                            '$tripadvisor_score', tripadvisor_weight
                        ]
                    }
                }
            },
            {
                '$addFields': {
                    'complete_sum': {
                        '$add': [
                            '$falstaff_weighted', '$google_weighted', '$tripadvisor_weighted',
                        ]
                    }
                }
            }
        ];
        if (req.body.location) {
            if (!req.body.location.distance || req.body.location.distance == 0) {
                return {
                    total: 0,
                    skip,
                    limit,
                    results: [],
                    message: "Query successful!"
                };
            }
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
                    'complete_sum': -1,
                    "_id": 1,
                }
            },

            {
                $skip: skip
            },
            {
                $limit: limit
            },
            {
                '$unwind': {
                    'path': '$ratings'
                }
            },
            {
                '$sort': {
                    'ratings.rated_by': 1
                }
            },
            {
                '$group': {
                    '_id': '$_id',
                    'name': {
                        '$first': '$name'
                    },
                    'ratings': {
                        '$push': '$ratings'
                    },
                    'homepage': {
                        '$first': '$homepage'
                    },
                    'location': {
                        '$first': '$location'
                    },
                    'price_category': {
                        '$first': '$price_category'
                    },
                    'price_category_level': {
                        '$first': '$price_category_level'
                    }
                }
            }
        ]);
        let total_agg = await restaurants.aggregate(count_query)
        let total_doc = await total_agg.next()
        let total = total_doc ? total_doc.total || 0 : 0;

        let results_agg = await restaurants.aggregate(final_query);
        let results = await results_agg.toArray();

        return {
            total,
            skip,
            limit,
            results,
            message: "Query successful!"
        };

    })().then((d) => {
        res.json(d)
    }).catch(e => {
        console.error(e)
        res.status(400)
        res.json({ message: e + "" })
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