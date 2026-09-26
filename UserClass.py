#Author: Eyan n
This is the user class, 
#This is the user class, It will define some of the basic
#attributes and methods as decribed in the UML
#Note: the UML was not perfect and this is a rough sketch

import datetime #for registeredAt var
import List

loggedIn = False

class User:

    def __init__(name, email, username):
        self.name = name
        self.userID = 0 # this should later be changed to getting it with rand, don't want to leave it unitialized
        self.email = email
        self.username = username
        self.registeredAt: 
        #self.ratings: List[Rating] = [] #it'll bug out at first becuase Rating class not define yet

    # these interact with rating package
    def add_review(self, stars, comment) -> Rating:
        #new_rating = Rating(stars, comment)
        #self.ratings.append(new_rating)
        #return new_rating

    def view_reviews(self) -> None:
        for rating in self.ratings:
            print(rating)

    def register(self) -> bool:
        self.registeredAt = datetime.now() #will have to change later
        return True

#these are interacting with Authenticatable, Authentication service, and Credentials
    def login(self, credentials: Credentials) -> bool:
        loggedIn = True
        return loggedIn

    def logout(self) -> None:
        loggedIn = False

    def update_password(self) -> str:
        pass
