import axios from "axios";
import { decode, encode } from "querystring";
import { MongoClient } from 'mongodb'
import { Client, PlaceInputType } from "@googlemaps/google-maps-services-js"
const places_key = "AIzaSyAhR0tAWZocf--xAaiLfS21Rdz9Ap961Sc"
const uri = "mongodb://root:devpassword@localhost:27017/";
const client = new MongoClient(uri);
let page = 0;
let gclient = new Client();


async function getRestaurants(region?: string, state?: string, page: number = 0) {
    let query = decode("query=&facets=*&facetFilters=%5B%22entity%3Arestaurant%22%2C%22valid_for%3Aat%22%5D&page=1&optionalFacetFilters=%5B%22region.country_short%3AAUT%22%2C%22premium%3A1%22%5D")
    console.log(query)
    let filters = JSON.parse(query.facetFilters as string)
    if (region) {
        filters.push(`region.country:${region}`)
    }
    if (state) {
        filters.push(`region.state:${state}`)
    }
    query.facetFilters = JSON.stringify(filters)
    query.page = page + ""
    //query.paginationLimitedTo = "20828"
    query.hitsPerPage = "100"
    let body_data = { params: encode(query) }

    let data = await axios.post("https://00sug0i4tw-dsn.algolia.net/1/indexes/falstaff_core/query?x-algolia-agent=Algolia%20for%20JavaScript%20(3.33.0)%3B%20Browser%20(lite)&x-algolia-application-id=00SUG0I4TW&x-algolia-api-key=ec2c26828f7727c47191a5d0658dccbb", JSON.stringify(body_data), {
        "headers": {
            "accept": "application/json",
            "accept-language": "en-US,en;q=0.9,de;q=0.8,zh-TW;q=0.7,zh-CN;q=0.6,zh-HK;q=0.5,zh;q=0.4",
            "cache-control": "no-cache",
            "content-type": "application/x-www-form-urlencoded",
            "pragma": "no-cache",
            "sec-ch-ua": "\" Not;A Brand\";v=\"99\", \"Google Chrome\";v=\"97\", \"Chromium\";v=\"97\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"macOS\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
            "Referer": "https://www.falstaff.at/",
            "Referrer-Policy": "strict-origin-when-cross-origin"
        }
    });
    console.log(`Fetched page ${page} of region ${region}`)
    return data.data
}
let regions_str = "Österreich,Deutschland,Italien,Schweiz,Frankreich,Spanien,USA,Großbritannien,Belgien,Kroatien,Niederlande,China,Ungarn,Slowenien,Japan,Dänemark,Tschechische Republik,Portugal,Schweden,Polen,Israel,Türkei,Brasilien,Russische Föderation,Irland,Australien,Südafrika,Norwegen,Südkorea,Griechenland,Finnland,Luxemburg,Marokko,Thailand,Ukraine,Lettland,Taiwan,Äquatorialguinea,Singapur,Vietnam,Kanada,Vereinigten Arabischen Emirate,Estland,Neuseeland,Bulgarien,Slowakei,Rumänien,Kuba,Island,Litauen,Peru,Argentinien,Liechtenstein,Uruguay,Indien,Laos,Mexiko,Barbados,Indonesien,Malaysia,Malta,Bosnien und Herzegowina,Jamaika,Monaco,Libanon,Macao,Antigua und Barbuda,Botsuana,Chile,Malediven,Montenegro,San Marino,Seychellen"
let skip_states = [];//["Wien"];
let skip_regions = [];//["Österreich", "Deutschland"];
(async () => {
    await client.connect();
    let db = client.db("le-foody-db")
    try {

        // await db.dropCollection("restaurants")
    } catch (error) {
        console.log("Collection was not present")
    }
    let collection = db.collection("restaurants")
    await collection.createIndex({
        "location": "2dsphere"
    })
    let regions = regions_str.split(",")//Object.keys(facet_probe.facets["region.country"])
    for (let region of regions) {
        if (skip_regions.includes(region)) {
            console.log("Skipping region", region)
            continue;
        }
        console.log(`Starting with region ${region}`)
        let facet_probe = await getRestaurants(region);
        let states = Object.keys(facet_probe.facets["region.state"])

        for (let state of states) {
            console.log(`Starting with state ${state}`)

            let scraping_region = true
            if (skip_states.includes(state)) {
                console.log("Skipping state!")
                scraping_region = false;
            }
            while (scraping_region) {
                let data = await getRestaurants(null, state, page)
                console.log(data)
                let restaurants = []
                for (let restaurant of data.hits) {
                    let place;
                    try {
                        place = await gclient.findPlaceFromText({
                            params: {
                                key: places_key,
                                input: restaurant.name,
                                inputtype: PlaceInputType.textQuery,
                                fields: ["name", "geometry", "price_level", "rating", "user_ratings_total", "formatted_address", "photo", "place_id", "business_status", "plus_code", "type"]
                            }
                        })
                    } catch (e) {
                        console.warn("Failed to reverse-search for ", restaurant.name, e)
                    }

                    let candidate = place && place.data.candidates.length > 0 ? place.data.candidates[0] : null

                    let coords = restaurant._geoloc ? [parseFloat(restaurant._geoloc.lng), parseFloat(restaurant._geoloc.lat),] : [0, 0]

                    if (coords.includes(NaN) || coords.includes(0)) {
                        console.log(`${restaurant.name} has no coords, maybe reverse-search?`)
                        if (candidate) {
                            let location = candidate.geometry.location
                            coords = [location.lng, location.lat]
                        } else {
                            console.log(`${restaurant.name} reverse search was not successful!`)
                        }

                    }
                    let ratings = [{
                        "rated_by": "Falstaff",
                        "score": restaurant.rating ? restaurant.rating.points_total : 0,
                        "score_max": 100,
                        "reviewers": 1
                    },]
                    if (candidate) {
                        ratings.push({
                            "rated_by": "Google",
                            "score": candidate.rating,
                            "score_max": 5,
                            "reviewers": candidate.user_ratings_total
                        })
                        restaurant.google_data = candidate;
                    } else {
                        ratings.push({
                            "rated_by": "Google",
                            "score": 0,
                            "score_max": 5,
                            "reviewers": 0
                        })
                    }
                    restaurant.ratings = ratings;
                    restaurant.location = {
                        type: "Point",
                        coordinates: coords
                    }
                    restaurants.push(restaurant)
                }
                if (restaurants.length == 0) {
                    scraping_region = false
                    page = 0;
                } else {
                    let result = await collection.insertMany(restaurants)
                    console.log(`inserted  ${result.insertedCount} elements`)
                    page++;
                }
            }
        }
    }
})().catch(e => {
    console.error(e)
})