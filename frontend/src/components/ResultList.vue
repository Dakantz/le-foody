<template>
  <v-container>
    <v-row>
      <v-col cols="12" sm="12">
        <v-simple-table>
          <template v-slot:default>
            <thead>
              <tr>
                <th class="text-left">Name</th>
                <th class="text-left">Falstaff Ratings</th>
                <th class="text-left">Google Ratings</th>
                <th class="text-left"></th>
                <th class="text-left">Link</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="result of results" :key="result._id">
                <td>{{ result.name }}</td>
                <td v-for="rating of result.ratings" :key="rating.rated_by">
                  {{ rating.score }}/{{ rating.score_max }}
                </td>
                <td>
                  <v-btn text @click="$emit('openInMap', result._id)">
                    <v-icon>mdi-map</v-icon>
                  </v-btn>
                </td>
                <td>
                  <v-btn
                    :href="'http://' + result.homepage"
                    target="_blank"
                    text
                  >
                    <v-icon>mdi-open-in-new</v-icon>
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </template>
        </v-simple-table>
      </v-col>
    </v-row>
    <v-row v-if="!loading && results.length == 0">
      <v-col cols="12" sm="12">
        <div class="text-center .text-h3">
          No restaurants found, please try a wider radius/other criterions
        </div>
      </v-col>
    </v-row>
    <v-row v-if="loading">
      <v-col cols="12" sm="12">
        <v-progress-linear indeterminate> </v-progress-linear>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12" sm="12" v-if="results.length != 0">
        <v-btn color="primary" class="align-center" @click="$emit('loadNext')">
          Load more ({{ results.length }}/{{ total }})
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  name: "result-list",
  props: {
    results: Array,
    loading: Boolean,
    total: Number,
  },
  data: () => ({}),
};
</script>
