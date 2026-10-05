#import Comment
import unittest
from RatingSystem.Rating import Rating
from RatingSystem.UserClass import User #rom mypackage.module1 import gr
from RatingSystem.Comment import Comment

#import UserClass
class TestRating: 
    def test_something(self):
        u1 = User("John Doe", "johndoe@gmail.com", "johnDoe20XX")
        print(u1)
    
if __name__ == "__main__":
    unittest.main()

    