/**
 * Created by dmacjam on 6.5.2017.
 */

$( function() {
  loadSampleTweets();
});


function loadSampleTweets(){
    $.ajax({
            url: "https://api.twitter.com/1.1/statuses/oembed.json?id=" + '851100020925399040',
            dataType: "jsonp",
            success: function(data) {
              $('#tweet_details').append(data.html);
            }
    });
}