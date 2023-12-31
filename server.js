const express = require("express");
const socket = require("socket.io");
const cors = require("cors");
const app = express();
const TheRoom = require('./TheRoom.js');//ref myGame from its class file
const TheCreator = require('./TheCreator.js');//ref myGame from its class file

app.use(cors());

var myCounter = 0; 
var roomArr=[];

app.use(express.static("public"));

const server = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + server.address().port);  
});

var io = socket(server);
io.on("connection", function (socket) {
  console.log("Player Connected...." + socket.id); //Not sending anything back cz by default a connected event is raised at the client... so i'll know
  var myOwnRoom;  
  

  socket.on("RoomJoining", function (data) {
    console.log("JoiningRequest from " + data);
    myOwnRoom =  getMeRoomId(data); //used incase of sudden disconnection
    
    socket.join(myOwnRoom);
    socket.emit("RoomJoining", "Joined room #" + myOwnRoom);
    
    console.log("postROOMJoined: " + myOwnRoom);
    
    if(roomArr[myOwnRoom]!=undefined){//cz a reconnect will appear here and throw error
    if(roomArr[myOwnRoom].count==4){
      roomArr[myOwnRoom].toBsent=[-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
      io.in(myOwnRoom).emit("RoomJoining", "Go");   
      console.log("GO GO GO");      
    }
    }
  });
  

  //Int Array data 1x1
  socket.on("myMoves", function (data) {
    console.log(data[0] + "|" + data[1] +"|"+data[2]);
    io.to(myOwnRoom).emit("myMoves",data);
    //socket.broadcast.to(myOwnRoom).emit("myMoves", data); 
    //socket.to(myOwnRoom).emit("myMoves", data); //data[3]will always be roomNo
    console.log("sent to: " + myOwnRoom);
    // if (data[0] === 999) {//only for regular victory reset will happen from here. BUT not for sudden disconnection... cz in that case 999 wont be received here
    //   if(roomArr[data[3]]!=undefined){  
    //     delete roomArr[data[3]];         
    //     console.log("reset from 999");
    //   }
    // } //delete stuff after last move
  });
  

  //Int Array data 2x2 server receives arr[0-4] and sendsback[1,2,3]cz plyNum & RoomNum doesnt need to be sentback
  socket.on("myMoves2x2", function (data) {
    console.log("Received: " + data); //[plyNum,what,move,taken,room]... data[4] will always be the room#

    if(roomArr[data[4]]!=undefined){ 
    
      var start = data[0] * 3;
      roomArr[data[4]].toBsent[start] = data[1];
      roomArr[data[4]].toBsent[start + 1] = data[2];
      roomArr[data[4]].toBsent[start + 2] = data[3];
      var toBsentTemp = roomArr[data[4]].toBsent;

      console.log("SettingUp >>  " + toBsentTemp);   


      if (!toBsentTemp.includes(-1)) { //only if all the -1 dont exist ... that means all players moves are filled in
        io.in(data[4]).emit("myMoves2x2", toBsentTemp); //everyone in room including sender
        console.log("---------sent to ALL: " + toBsentTemp);   

        //How to reset the my2dArr[room#] thats keeping track of the moves for the next set of moves to be filled in
        //1.if game is going on normally with no deaths OR the game is fully ended... for both cases reinitialise the my2dArr 
        //2.if there may be a few finishes but the game still hasnt ended, then we cant make those deaths into -1 cz you will lose their information
        let finishes = toBsentTemp.filter(x => x === 999).length;          
        if(!toBsentTemp.includes(999)){ roomArr[data[4]].toBsent = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];}//regular reset
        else if( finishes===3 ||  (toBsentTemp[0]===999 && toBsentTemp[3]===999) || (toBsentTemp[6]===999 && toBsentTemp[9]===999) ){
         //if not a single 999(finish)is there(means game is on) ...OR... (3 finishes... OR ...2 finishes of the same team)... means game is over  
          delete roomArr[data[4]];//resetted room variable
        }                
        else{
            //but if 999 is there & the Game hasnt ended.. dont disturb those 3vals.. and put -1 for the others
            for(var i =0; i<12; i++ ){
              if(toBsentTemp[i]===999){i+=2;}//dont touch (this value & next 2 vals) of this finished player
              else{toBsentTemp[i] = -1;}   //any other that isnt 999(& its 2 other vals) must be reset to -1
            }
          roomArr[data[4]].toBsent = toBsentTemp;//special reset taken place
        }

      console.log("resetted toBsent: " + toBsentTemp);      
      }
    }//only if its not undefined
  });

  
  
  //For Cheater who shuts browser... server will receive normal 1x1 moves with 999 in data[0]... & send this to other player, so YOUWON can be displayed
  socket.on("Cheater1x1", function (data) {//here you can do a reset cz... the other player will never be needed to reply
    console.log("From Cheater1x1... " + data); 
    socket.to(data[3]).emit("myMoves", data);
    if(roomArr[data[3]]!=undefined){   delete roomArr[data[3]]; }//very rare but just doing this to avoid a crash
    console.log("reset from Cheater1x1");
  });


  //For Cheater who shuts browser... server will receive [positionInArray,present,taken].  toBsent will set [999, present, taken]  
  socket.on("Cheater2x2", function (data) {
    console.log("From Cheater... " + data); 

    if(roomArr[data[3]]!=undefined){ //very rare but just doing this to avoid a crash
      var start = data[0];//this is already the plyNum*3.. so server doesnt need to do calculations to find the position in toBeSent
      roomArr[myOwnRoom].toBsent[start] = 999;//bcz he cheated
      roomArr[myOwnRoom].toBsent[start + 1] = data[1];
      roomArr[myOwnRoom].toBsent[start + 2] = data[2];
    }
    
    //Now toBsent will never have -1,-1,-1 at the position of the player who discnnted, hence it will never wait
    console.log("toBsent reset from Cheater: " + roomArr[myOwnRoom].toBsent);//for that players moves..& send the moves to everyone
  });
  
  
  socket.on("disconnect", function () {
    console.log("Player Disconnected x-x-x-x-x-x from Room#" + myOwnRoom);    
    console.log(socket.rooms);
  });

});//socket ends herexxxxxxxxxxxxx


function getMeRoomId(passedPara){//we need this helper function to tell us the index(id) from the pi value(room_num)
  console.log("func()...." + passedPara);
  for (const i in roomArr) {
    //console.log(objs);
  if (roomArr[i].room_num == passedPara ) {
    console.log(roomArr[i]);
    return roomArr[i].id;
    break;
  }
}
}


//https://equal-tulip-cream.glitch.me/auth?room=42527&gm=2
app.get("/auth", (request, response) => {
  console.log("Room# " + request.query.room + " |Game " +  request.query.gm);
  const para1 = parseInt(request.query.room, 10); //cause QueryStr is always a string
  const para3 = parseInt(request.query.gm, 10); //1for 1x1... 2 for 2x2

  response.setHeader("Content-Type", "application/json");
  var indx = getMeRoomId(para1);
  console.log("got id: " + indx + " from " + para1);
  
  if(roomArr[indx]!=undefined){    
  if (roomArr[indx].room_num == para1) {//authPassed!
    roomArr[indx].count++;
    let cnt = roomArr[indx].count;
    console.log("Room count..." + roomArr[indx].count);

    if (para3 === 2) {
      if (cnt <= 4) {
        response.send(JSON.stringify({ message: "Access Granted" }));
      } else {
        response.send(JSON.stringify({ message: "Access Denied" }));
      }
    } else if (para3 === 1) {
      if (cnt <= 2) {
        response.send(JSON.stringify({ message: "Access Granted", ply: cnt }));
      } else {
        response.send(JSON.stringify({ message: "Access Denied", ply: -1 }));
      } //-1 means nothing
    }
    
  }} 
  else { //authFAILED
    response.send(JSON.stringify({ message: "Access Denied" }));
  }
    
});

//https://equal-tulip-cream.glitch.me/create
app.get("/create", (request, response) => {
  console.log("create Request....");

  response.setHeader("Content-Type", "application/json");
  
  var obj = new TheCreator(myCounter);
  obj.giveMeRoomNum();
  var room_obj = new TheRoom(myCounter,obj.roomNum);
  room_obj.count = 1; //first guy
  roomArr[myCounter] = room_obj;

  console.log("Room#..." + roomArr[myCounter].id  + "|Num " + roomArr[myCounter].room_num +  "|ply#  " + roomArr[myCounter].count );

  myCounter++;
  if(myCounter==555){myCounter=0;}//resetting it cz we only have 554array boxes
  
  response.send(JSON.stringify({ message: "Created", room: obj.roomNum }));
});



// Client sends a message
// socket.on('message', function(msg){
//    // Emit the message to all clients in 'game' room except the sender
//    socket.broadcast.to('game').emit('message', msg);
// });
