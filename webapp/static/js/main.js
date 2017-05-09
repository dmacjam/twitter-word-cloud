$.getScript("static/js/d3.layout.cloud.js", function(){
    main();
});

function main() {
    $( function() {
        setupSlider();
    });

    var frequency_list = [{"text": "Search", "csize": 90, "followers_count": 90}, {"text": "Twitter", "csize": 70, "followers_count": 140}, {"text": "Go!", "csize": 80, "followers_count": 80}, {"text": "upper", "csize": 40, "followers_count": 40}, {"text": "searchbar", "csize": 55, "followers_count": 5}, {"text": "push", "csize": 30, "followers_count": 30}, {"text": "button", "csize": 30, "followers_count": 30}, {"text": "zoom", "csize": 30, "followers_count": 30}, {"text": "drag", "csize": 20, "followers_count": 20}, {"text": "enjoy", "csize": 90, "followers_count": 90}, {"text": "filter", "csize": 35, "followers_count": 35}];
    //var frequency_list2 = [{"text": "Search", "csize": 100, "followers_count": 100}, {"text": "Twitter", "csize": 75, "followers_count": 75}];

    var words_history = [frequency_list];
    var words_hash_history = [hashFromArray(frequency_list)];
    var total_seconds = 0;
    var current_index = 0;
    var size_param = 'csize';
    var colors = d3.scale.linear().domain([0, 1]).range(['#00cdff', '#ff1e00']);  //.interpolate(d3.interpolateHcl)
    var width = window.innerWidth-(0.2*window.innerWidth)-20;
    var height = window.innerHeight-(0.1*window.innerHeight)-20;
    var min_filter, max_filter;
    var zoom = d3.behavior.zoom()
        .scaleExtent([1, 10])
        .on("zoom", zoomed);
    var container, svg;

    init_chart();
    call_draw(frequency_list);

    /**
     * Initialize word html elements.
     */
    function init_chart(){
      container = d3.select("#chart").append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("class", "wordcloud")
      .call(zoom);

      svg = container.append("g");
      svg.attr("transform", "translate("+width/2+","+height/2+")")
      .append("g");
    }

    /**
     * Draw word cloud to html elements and set listeners.
     * @param words Words to draw in  format as array of objects with variables text, csize, followers_count
     */
    function draw(words) {
      var filtered_count = 0;
      var textContainer = svg.selectAll("text").data(words);
      textContainer.enter().append("text");
      textContainer.style("font-size", function(d) { return d.size + "px"; })
          .style("fill", function(d) {
              if(words_history.length > current_index+1){
                  var index = 0;
                  var diff_name = '!max_diff!';
                  if(size_param === 'followers_count'){
                      index = 1;
                      diff_name = '!max_diff_followers!';
                  }
                  actual_count = words_hash_history[current_index][d.text][index];
                  previous_count = words_hash_history[current_index+1][d.text];
                  diff =  Math.ceil((words_hash_history[current_index][diff_name] - words_hash_history[current_index+1][diff_name]) / 4);
                  if(!(d.text in words_hash_history[current_index+1])){
                      return '49ff00';
                  }
                  else if(diff > 0){
                      previous_count = previous_count[[index]];
                      color_value = (actual_count-previous_count) / diff;
                  }else{
                      color_value = 0;
                  }
                  return colors(color_value);
              }else{
                  return colors(0);
              }
          })
          .style("font-family", "Impact")
          .on('click', word_clicked);
      textContainer.attr("transform", function(d) {
          var skew = 0;
          if(!isNaN(min_filter) && (d.count < min_filter)){
                skew = 55;
                filtered_count +=1;
          }
          if(!isNaN(max_filter) && d.count > max_filter){
                skew = -55;
                filtered_count +=1;
          }
            return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")skewX("+skew+")";
          })
          .attr("text-anchor", "middle")
          .text(function(d) { return d.text; })
          .append("text:title").text(function(d) { return d.text +': '+ d.count; });

      $("#filtered-info").text("");
      if (words_history.length > current_index){
          var median_name = '!median!';
          if(size_param === 'followers_count'){
              median_name = '!median_followers!';
          }
          $("#filtered-info").text("Filtered: "+filtered_count+"/"+words.length+
              "(median="+words_hash_history[current_index][median_name]+")");
      }
    }

    /**
     * Update word cloud with new words.
     * @param words
     */
    function call_draw(words) {
        d3.select("svg").remove();
        init_chart();

        if(words.length > 0){
            d3.layout.cloud().size([width, height])
              .words(words)
              .padding(10)
              .rotate(function() { return ~~(Math.random() * 1) * 90; })
              .fontSize(function(d) { return d.size; })
              .font("impact")
              .on("end", draw)
              .start(size_param);
        }
    }

    /**
     * Update function for visualization which is called periodically.
     * It is used to store history of words, update screen info and compute words statistics.
     */
    var updateViz = function(){
      $.getJSON('/stream', function(data) {
        console.log("Stream:" + data);
        if(data.length > 0){
            $('.overlay').hide();
            words_history.unshift(data);
            words_hash_history.unshift(hashFromArray(data));
            words_history = words_history.slice(0, 10);
            words_hash_history = words_hash_history.slice(0,10);
            current_index = 0;
            total_seconds += 1;
            $("#seconds").text("Total "+(total_seconds*5)+" seconds.");
            call_draw(data);
        }
        $.getJSON('/tweet_count', function(count) {
            if (count){
                $('#tweets-count').text(count);
            }
        });
      });
      //call_draw(frequency_list);
    };
    var refresh = window.setInterval(updateViz, 5000);
    //var refresh = null;

    /**
     * Button listeners.
     *
     */

    $("#pause-btn").click(function (event) {
        $("#pause-btn > i").removeClass('fa-pause');
        $("#pause-btn > i").removeClass('fa-play');
        if (refresh) {
            $("#pause-btn > i").addClass('fa-play');
            window.clearInterval(refresh);
            refresh = null;
        }else{
            unPause();
        }
    });

    $("#filter-btn").click(function (event) {
        min_filter = parseInt($("#min-filter").val());
        max_filter = parseInt($("#max-filter").val());
        call_draw(words_history[current_index]);
    });

    $("#reset-btn").click(function (event) {
        $('.overlay').show();
        $.ajax({
              method: "GET",
              url: "/close",
              success: function () {
                  reset();
                  $("#search-topic").val("");
                  call_draw(frequency_list);
                  $('.overlay').hide();
              }
          })
    });

    $("#search-btn").click(function( event ) {
      var topic = $("#search-topic").val();
      if(topic.length > 2){
          $('.overlay').show();
          $.ajax({
              method: "POST",
              url: "/topic",
              data: JSON.stringify({ topic: topic }),
              dataType: "json",
              contentType: "application/json; charset=UTF-8",
              mimeType: 'application/json'
          })
      }
      reset();
      event.preventDefault();
    });

    $("input[name='word-size']").change(function(e){
        radio_checked = $('input:radio[name="word-size"]:checked').val();
        if(radio_checked === "word-count"){
            size_param = "csize";
        }else if (radio_checked === "followers"){
            size_param = "followers_count";
        }
        call_draw(words_history[current_index]);
    });

    /**
     * Listeners.
     */

    function zoomed() {
      svg.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
    }

    function word_clicked(d, i) {
        $('#tweet_details > twitterwidget').remove();
        $('#tweet-word').text(d.text);
        $.ajax({
              method: "POST",
              url: "/tweets_for_word",
              data: JSON.stringify({ word: d.text }),
              dataType: "json",
              contentType: "application/json; charset=UTF-8",
              mimeType: 'application/json',
              success: function (tweet_ids) {
                  console.log('Data '+tweet_ids);
                  for(i=0; i< tweet_ids.length; i++){
                      $.ajax({
                      url: "https://api.twitter.com/1.1/statuses/oembed.json?id=" + tweet_ids[i],
                      dataType: "jsonp",
                      success: function(data) {
                        $('#tweet_details').append(data.html);
                      }
                    });
                  }
              }
          });
    }

    /**
     * Helper functions.
     */

    /**
     * JqueryUI timeline slider setup.
     */
    function setupSlider(){
        var handle = $( "#custom-handle" );
        $( "#slider" ).slider({
            max: 0,
            step: 5,
            min: -50,
            value: 0,
            range: "max",
            create: function() {
              handle.text( "(-5,0)s" );
            },
            slide: function( event, ui ) {
              if (refresh){
                  $("#pause-btn").trigger( "click" );
              }
              handle.text( "("+(ui.value-5)+","+(ui.value)+")s");
              var period = (ui.value / -5);
              timeline(period)
            }
        });
    }

    /**
     * Reset variables and information shown on the screen.
     */
    function reset(){
        $('#tweet-word').text('Tweets');
        $("#min-filter").val("");
        min_filter = NaN;
        $("#max-filter").val("");
        max_filter = NaN;
        words_history = [];
        words_hash_history = [];
        total_seconds = 0;
        current_index = 0;
        $( "#custom-handle" ).text( "(-5, 0)s" );
        $( "#slider" ).slider("value", 0);
        $('#tweet_details > twitterwidget').remove();
        $("#seconds").text("");
        $('#tweets-count').text(0);
        unPause();
    }

    /**
     * Move timeline and select data for a period.
     */
    function timeline(period){
        if(period < words_history.length){
            current_index = period;
            call_draw(words_history[period]);
        }
    }

    /**
     * Create hash from input array.
     * @param array
     * @returns {{}}
     */
    function hashFromArray(array) {
        var hash = {};
        var max_count = array[0]['csize'];
        var max_followers = array[0]['followers_count'];
        var counts = [];
        var followers = [];
        for(var i=0; i < array.length; i++){
            hash[array[i]['text']] = [array[i]['csize'], array[i]['followers_count']];
            counts.push(array[i]['csize']);
            followers.push(array[i]['followers_count']);
            if(array[i]['csize'] > max_count){
                max_count = array[i]['csize'];
            }
            if(array[i]['followers_count'] > max_followers){
                max_followers = array[i]['followers_count'];
            }
        }
        hash['!max_diff!'] = max_count;
        hash['!max_diff_followers!'] = max_followers;
        hash['!median!'] = math.median(counts);
        hash['!median_followers!'] = math.median(followers);
        return hash;
    }

    /**
     * Reset pause.
     */
    function unPause(){
        $("#pause-btn > i").removeClass('fa-pause');
        $("#pause-btn > i").removeClass('fa-play');
        window.clearInterval(refresh);
        refresh = null;
        $("#pause-btn > i").addClass('fa-pause');
        refresh = window.setInterval(updateViz, 5000);
        $( "#custom-handle" ).text( "0 s" );
        $( "#slider" ).slider("value", 0);
    }
}
