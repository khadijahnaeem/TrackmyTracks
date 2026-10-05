#author: Eyan Ghirbn
#Rating Class
from .Comment import Comment

class Rating:
    def __init__(stars, review) : #I want to make review of type Comment
        #if (stars > 5 || stars < 1){
        #   throw new IllegalArgumentException("Stars must be between 1-5");
  
        self.stars = stars
        self.review = review

    def getStars(self):
        return self.stars
    

    def getReview(self):
        return this.review

        

