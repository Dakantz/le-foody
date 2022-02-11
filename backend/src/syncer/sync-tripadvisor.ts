import axios from "axios";
import { decode, encode } from "querystring";
import { MongoClient } from 'mongodb'
import _ from "lodash"
import puppeteer, { ElementHandle, Page } from 'puppeteer'
import { Client, PlaceInputType } from "@googlemaps/google-maps-services-js"
const places_key = "***REMOVED***"
const uri = "mongodb://root:devpassword@localhost:27017/";
const client = new MongoClient(uri);
let gclient = new Client();

const region_links = ["https://www.tripadvisor.com/Restaurants-g190410-Austria.html"]

let page = 0;

let db = client.db("le-foody-db")
let collection = db.collection("restaurants")

async function prepareData(existing: any, restaurant: any) {
    let candidate = existing.google_data;
    let coords = null;
    if (!candidate) {
        console.log("no google data yet for ", restaurant.name)
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

        candidate = place && place.data.candidates.length > 0 ? place.data.candidates[0] : null
        existing.google_data = candidate;
    }
    if (!candidate) {
        candidate = {}
        candidate.rating = 0;
        candidate.user_ratings_total = 0;
    }
    if (candidate) {
        let location = candidate.geometry.location
        coords = [location.lng, location.lat]
    }
    if (Object.keys(existing).length == 0) {
        existing = _.cloneDeep(restaurant);
    }
    if (!existing.location && coords) {
        existing.location = {
            type: "Point",
            coordinates: coords
        }
    }
    existing.tripadvisor_data = _.cloneDeep(restaurant);
    let ratings: any[] = existing.ratings;
    let existing_rating = ratings ? ratings.find(r => r.rated_by == "Tripadvisor") : null
    if (existing_rating) {
        existing_rating.score = restaurant.averageRating
        existing_rating.reviewers = restaurant.userReviewCount
    } else {
        if (existing.ratings) {
            existing.ratings.push({
                "rated_by": "Tripadvisor",
                "score": restaurant.averageRating,
                "score_max": 5,
                "reviewers": restaurant.userReviewCount
            })
        } else {
            existing.ratings = [{
                "rated_by": "Tripadvisor",
                "score": restaurant.averageRating,
                "score_max": 5,
                "reviewers": restaurant.userReviewCount
            }, {
                "rated_by": "Google",
                "score": candidate.rating,
                "score_max": 5,
                "reviewers": candidate.user_ratings_total
            }, {
                "rated_by": "Falstaff",
                "score": 0,
                "score_max": 100,
                "reviewers": 1
            }]
        }

    }
    if (!existing.homepage) {
        let url = restaurant.menuUrl as string
        restaurant.homepage = url ? url.replace("http://", "").replace("https://", "") : null
    }
    return existing
}
async function handleTripadvisor(restaurant: any) {
    let existing_restaurant = null
    try {
        existing_restaurant = await collection.findOne({
            "name": restaurant.name

        })
    } catch (error) {
        console.warn("No restaurant yet in DB for", restaurant.name)
    }

    if (existing_restaurant) {
        let modified_data = await prepareData(existing_restaurant, restaurant)
        await collection.replaceOne({
            "_id": existing_restaurant._id

        }, modified_data)
        console.log(`update  ${existing_restaurant._id}`)
    } else {

        let modified_data = await prepareData({}, restaurant)
        let result = await collection.insertOne(modified_data)
        console.log(`inserted  ${result.insertedId}`)
    }
}
let skip_states = [];//["Wien"];
let skip_regions = [];//["Österreich", "Deutschland"];
let browser: puppeteer.Browser = null;
async function acceptCookies(page: Page) {

    await page.waitForSelector("#onetrust-accept-btn-handler")
    await page.click("#onetrust-accept-btn-handler")
    await page.waitForTimeout(1000)
}
const do_tripadvisor_prepare = false;
(async () => {
    await client.connect();
    try {

        // await db.dropCollection("restaurants")
    } catch (error) {
        console.log("Collection was not present")
    }

    if (do_tripadvisor_prepare) {

        let result = await collection.updateMany({ ratings: { $not: { $elemMatch: { rated_by: "Tripadvisor" } } } }, {
            $push: {
                ratings: {
                    rated_by: "Tripadvisor",
                    score: 0,
                    score_max: 5,
                    reviewers: 0
                } as never
            }
        })
        console.log(`Updated ${result.modifiedCount} entries!`)
    }

    browser = await puppeteer.launch({
        headless: false
    });

    for (let link of region_links) {

        const page = await browser.newPage();
        await page.goto(link);
        await acceptCookies(page);
        let subregion_links = await page.$$(".geo_entry")
        for (let index = 0; index < subregion_links.length; index++) {

            await page.waitForSelector(".geo_entry")
            subregion_links = await page.$$(".geo_entry")

            await subregion_links[index].click()
            console.log("Clicked on subregion", index)

            await page.waitForSelector(".ui_checkbox.bwWEH.w")

            if (index == 0) {
                await acceptCookies(page);
            }
            console.log("Should be in subregion...")

            let restaurants_clicker = await page.$$(".ui_checkbox.bwWEH.w")

            await restaurants_clicker[2].click();
            let has_more_pages = true


            console.log("We are ready to scrape...")
            while (has_more_pages) {
                let batch_response = await page.waitForResponse(async (res) => {

                    if (res.status() == 200 && res.url().includes("batch")) {
                        let data = res.request().postData()
                        console.log("got batch request with post data:", data)
                        if (data.includes("restaurants")) {
                            return true;
                        }
                    }
                    return false;
                })
                let batch_data = await batch_response.json()
                let rests_lvl0 = batch_data[Object.keys(batch_data)[0]]
                let restaurants = rests_lvl0[Object.keys(rests_lvl0)[0]].body.restaurants
                for (const restaurant of restaurants) {
                    await handleTripadvisor(restaurant)
                }

                console.log("Inserted all entries of current page!")
                let next_disabled = await page.$(".nav.next.disabled")
                if (next_disabled) {
                    has_more_pages = false;
                } else {
                    console.log("going on next page...")
                    await page.click(".nav.next")
                }
            }
            await page.goBack();

        }




    }
})().catch(e => {
    console.error(e)
    // browser.close();
})